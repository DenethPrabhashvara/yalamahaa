// Official weather warnings from the Department of Meteorology CAP feed, into
// weather_advisories / weather_advisory_texts for models/newsModel.js to serve.
// Turned on / off from the admin portal (app_settings.weather_feed), like the flood job.
//
// Being a good citizen of someone else's government server is a design constraint here:
// the feed is Public Domain but that is not a licence to hammer it. The index carries
// cache-control: max-age=300, so we poll every 15 minutes with a conditional request and
// in the steady state that is a single 304 per interval and nothing else.
const db = require('../config/db.js')
const logger = require('../utils/logger.js')
const { parseCap, parseRssIds, referencedIds, classify } = require('./capParse.js')
const { parseAreaDesc } = require('./slPlaces.js')

const EVERY_MS = 15 * 60 * 1000
const TIMEOUT_MS = 15000
const LANGS = ['en', 'si', 'ta']
const BASE = (process.env.MET_FEED_BASE || 'https://was.meteo.gov.lk/cap').replace(/\/$/, '')
const UA = process.env.MET_FEED_UA || 'YalaMaha/1.0 (Sri Lanka farmer flood-warning portal)'
const KEEP_DAYS = 30

// Set from the index's response so the next poll can ask "only if it changed".
let etag = null
let lastModified = null

async function feedOn() {
  const r = await db.query("SELECT value FROM app_settings WHERE key = 'weather_feed'")
  return r.rows[0] ? r.rows[0].value === true : true
}

async function get(url, extraHeaders) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml', ...extraHeaders },
      signal: ctrl.signal,
    })
    if (res.status === 304) return { status: 304, body: null, res }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { status: res.status, body: await res.text(), res }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Which of the index's file ids we don't already hold.
 *
 * This is what keeps us off the feed: without it, any change to the index would mean
 * downloading every listed alert again just to read the <identifier> inside it. The ids
 * are 32-character content hashes, so edited content arrives as a new id; an alert whose
 * id is unchanged is unchanged.
 */
async function unseen(ids) {
  if (!ids.length) return []
  const r = await db.query('SELECT feed_id FROM weather_advisories WHERE feed_id = ANY($1::text[])', [ids])
  const have = new Set(r.rows.map((row) => row.feed_id))
  return ids.filter((id) => !have.has(id))
}

async function save(cap, texts, feedId) {
  const { colour, cyclone, banner, tone } = classify(cap)
  const areas = parseAreaDesc(cap.areaDesc)
  if (!cap.severity) logger.warn(`weather feed: ${cap.identifier} has no severity`)
  if (!areas.districts.length && !areas.allIsland) {
    logger.warn(`weather feed: ${cap.identifier} matched no district - showing it to everyone`)
  }

  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    // The sent guard makes a re-run a no-op and stops an older copy of an alert from
    // overwriting a newer one if two API instances poll at the same time.
    const r = await client.query(
      `INSERT INTO weather_advisories
         (identifier, feed_id, sender, sent, expires, status, msg_type, scope, category, event,
          response_type, urgency, severity, certainty, colour, is_cyclone, banner, tone,
          districts, divisions, all_island, web, source)
       VALUES ($1,$22,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'metdept')
       ON CONFLICT (identifier) DO UPDATE SET
         feed_id = EXCLUDED.feed_id,
         sender = EXCLUDED.sender, sent = EXCLUDED.sent, expires = EXCLUDED.expires,
         status = EXCLUDED.status, msg_type = EXCLUDED.msg_type, scope = EXCLUDED.scope,
         category = EXCLUDED.category, event = EXCLUDED.event,
         response_type = EXCLUDED.response_type, urgency = EXCLUDED.urgency,
         severity = EXCLUDED.severity, certainty = EXCLUDED.certainty,
         colour = EXCLUDED.colour, is_cyclone = EXCLUDED.is_cyclone,
         banner = EXCLUDED.banner, tone = EXCLUDED.tone,
         districts = EXCLUDED.districts, divisions = EXCLUDED.divisions,
         all_island = EXCLUDED.all_island, web = EXCLUDED.web
       WHERE weather_advisories.sent <= EXCLUDED.sent
       RETURNING id`,
      [
        cap.identifier, cap.sender, cap.sent, cap.expires, cap.status, cap.msgType, cap.scope,
        cap.category, cap.event, cap.responseType, cap.urgency, cap.severity, cap.certainty,
        colour, cyclone, banner, tone, areas.districts, areas.divisions, areas.allIsland, cap.web,
        feedId || null,
      ]
    )

    // No row back means the stored copy is newer; leave its texts alone too.
    let id = r.rows[0] && r.rows[0].id
    if (!id) {
      await client.query('COMMIT')
      return null
    }

    for (const [lang, t] of Object.entries(texts)) {
      await client.query(
        `INSERT INTO weather_advisory_texts (advisory_id, lang, event, headline, description, instruction, area_desc)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (advisory_id, lang) DO UPDATE SET
           event = EXCLUDED.event, headline = EXCLUDED.headline, description = EXCLUDED.description,
           instruction = EXCLUDED.instruction, area_desc = EXCLUDED.area_desc`,
        [id, lang, t.event, t.headline, t.description, t.instruction, t.areaDesc]
      )
    }

    // A Cancel withdraws the alerts it references, so retire them at once rather than
    // letting a cancelled cyclone warning sit there until its original expiry.
    if (cap.msgType === 'Cancel') {
      const refs = referencedIds(cap.references)
      if (refs.length) {
        await client.query(
          `UPDATE weather_advisories SET expires = NOW()
           WHERE identifier = ANY($1::text[]) AND (expires IS NULL OR expires > NOW())`,
          [refs]
        )
      }
    }

    await client.query('COMMIT')
    return { id, banner, colour, event: cap.event }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

/** One pass. Returns the advisories it stored. */
async function pollFeed() {
  if (!(await feedOn())) return []

  const index = await get(`${BASE}/en/rss.xml`, {
    ...(etag ? { 'If-None-Match': etag } : {}),
    ...(lastModified ? { 'If-Modified-Since': lastModified } : {}),
  })
  if (index.status === 304) return []
  etag = index.res.headers.get('etag') || etag
  lastModified = index.res.headers.get('last-modified') || lastModified

  const listed = parseRssIds(index.body)
  if (!listed.length) {
    // An empty channel is the normal state when no advisory is in force, so only a feed
    // that has items we can't read, or isn't RSS at all, is worth a warning.
    const body = index.body || ''
    if (/<item[\s>]/i.test(body)) logger.warn('weather feed: index has items but none with a usable id')
    else if (!/<channel[\s>]/i.test(body)) logger.warn('weather feed: index is not an RSS feed')
    else logger.debug('weather feed: no advisories in force')
    return []
  }

  // Skip what we already hold before downloading anything.
  const todo = await unseen(listed.map((i) => i.id))
  if (!todo.length) return []

  // English first: it carries the <identifier> and is the only language we classify from.
  const stored = []
  for (const id of todo) {
    let english
    try {
      const got = await get(`${BASE}/en/${id}.xml`)
      english = parseCap(got.body, 'en')
      if (!english) {
        logger.warn(`weather feed: ${id} is not a usable CAP alert`)
        continue
      }
    } catch (err) {
      logger.warn(`weather feed: ${id} (en) failed: ${err.message}`)
      continue
    }

    // Serially, not in parallel: three polite requests beat three simultaneous ones.
    const texts = { en: english }
    for (const lang of LANGS.filter((l) => l !== 'en')) {
      try {
        const got = await get(`${BASE}/${lang}/${id}.xml`)
        const parsed = parseCap(got.body, lang)
        if (parsed) texts[lang] = parsed
      } catch (err) {
        // Not fatal: the endpoint falls back to English per advisory.
        logger.warn(`weather feed: ${id} (${lang}) failed: ${err.message}`)
      }
    }

    try {
      const saved = await save(english, texts, id)
      if (saved) {
        stored.push(saved)
        logger.info(
          `weather advisory ${english.event} (${english.severity}/${saved.colour}` +
          `${saved.banner ? ', BANNER' : ''}) in ${Object.keys(texts).join('/')}`
        )
      }
    } catch (err) {
      logger.error(`weather feed: saving ${english.identifier} failed: ${err.message}`)
    }
  }

  await db.query(`DELETE FROM weather_advisories WHERE expires < NOW() - INTERVAL '${KEEP_DAYS} days'`)
  return stored
}

function startWeatherFeedJob() {
  if (process.env.WEATHER_FEED_ENABLED === 'false') {
    logger.info('weather feed job disabled by WEATHER_FEED_ENABLED')
    return null
  }
  const run = () => pollFeed().catch((err) => logger.error(`weather feed job failed: ${err.message}`))
  // Jittered, so several restarting instances don't all hit the feed on the same second.
  setTimeout(run, Math.floor(Math.random() * 30000))
  return setInterval(run, EVERY_MS)
}

module.exports = { startWeatherFeedJob, pollFeed, feedOn }
