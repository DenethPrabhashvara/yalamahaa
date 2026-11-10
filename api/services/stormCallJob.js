// Automatic warning CALLS to farmers, from two sources:
//   weather  very heavy rain or strong winds forecast at the farmer's location (Open-Meteo)
//            up to STORM_DAYS_AHEAD (default 4) days ahead - services/stormForecast.js
//   ml       the ML model expects the farmer's tank / reservoir to fill and spill within its
//            14-day horizon - services/tankForecastAlerts.js
// One call per farmer per storm / per tank spill (and at most one call per farmer per run).
// Runs every hour; calls are only placed 7am-8pm Sri Lanka time.
//
// The call is spoken in Sinhala by SinhalaVITS (services/sinhalaTts.js), served from this API at
// /api/voice/generated/ for Twilio to play. If SinhalaVITS is down, or Twilio can't reach the file
// (PUBLIC_API_URL), the call falls back to English so the warning still goes out.
//
// STORM_CALL_MODE decides what actually happens:
//   off      nothing runs
//   dry-run  everything except the call: who would be rung is written to storm_calls
//   trial    for a Twilio free trial: only numbers in TWILIO_VERIFIED_NUMBERS are rung, at most
//            STORM_CALL_MAX_PER_RUN per run; everyone else is logged as skipped_trial (the default)
//   live     every matching farmer is rung
// Also switched on / off from the admin portal (app_settings.storm_calls), like the flood job.
const db = require('../config/db.js')
const logger = require('../utils/logger.js')
const forecast = require('./stormForecast.js')
const tanks = require('./tankForecastAlerts.js')
const words = require('./alertMessages.js')
const { sinhalaAudio } = require('./sinhalaTts.js')
const { placeCall, toE164, twilioConfigured } = require('./twilioVoice.js')

const EVERY_MS = 60 * 60 * 1000
const MODES = ['off', 'dry-run', 'trial', 'live']
const LANGS = ['si', 'en', 'si+en']
const SOURCES = ['weather', 'ml']
const MAX_ATTEMPTS = 3
const TONE_SECONDS = 3

function settings(env = process.env) {
  const mode = MODES.includes(env.STORM_CALL_MODE) ? env.STORM_CALL_MODE : 'trial'
  const publicUrl = (env.PUBLIC_API_URL || 'https://farmer.yalamaha.aurawebsolution.online').replace(/\/$/, '')
  const sources = String(env.STORM_CALL_SOURCES || 'weather,ml').split(',').map((s) => s.trim()).filter((s) => SOURCES.includes(s))
  return {
    mode,
    lang: LANGS.includes(env.STORM_CALL_LANG) ? env.STORM_CALL_LANG : 'si',
    sources,
    verified: new Set(String(env.TWILIO_VERIFIED_NUMBERS || env.VOICE_DEMO_NUMBER || '')
      .split(',').map(toE164).filter(Boolean)),
    maxPerRun: Number(env.STORM_CALL_MAX_PER_RUN) || (mode === 'trial' ? 3 : 1000),
    // a trial call starts with Twilio's notice and waits for a key press
    trialExtra: mode === 'trial' ? 25 : 0,
    firstHour: Number(env.STORM_CALL_FROM_HOUR ?? 7),
    lastHour: Number(env.STORM_CALL_TO_HOUR ?? 20),
    publicUrl,
    toneUrl: env.STORM_CALL_TONE_URL ?? `${publicUrl}/api/voice/hazard-tone.wav`,
  }
}

async function callsOn() {
  const r = await db.query("SELECT value FROM app_settings WHERE key = 'storm_calls'")
  return r.rows[0] ? r.rows[0].value === true : false
}

function colomboHour(now = new Date()) {
  return Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Colombo' }))
}

// ---- building the call ----

// Twilio fetches the audio from us, so check it can before relying on it
const reachable = new Map()
async function publiclyServed(url) {
  if (reachable.has(url)) return true
  let ok = false
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    await res.body?.cancel()
    ok = res.ok && /^audio\//.test(res.headers.get('content-type') || '')
  } catch { /* not reachable */ }
  // only successes are remembered, so a file that wasn't up yet is tried again next run
  if (ok) reachable.set(url, true)
  return ok
}

/**
 * TwiML + time limit for an alert in the configured language.
 * { twiml, timeLimit, lang (what was actually used), audio (Sinhala file name), note (why it fell back) }
 */
async function buildCall(alert, s) {
  const parts = s.toneUrl ? [{ play: s.toneUrl }] : []
  let seconds = s.toneUrl ? TONE_SECONDS : 0
  let used = 'en'
  let audio = null
  let note = null

  if (s.lang !== 'en') {
    try {
      const a = await sinhalaAudio(alert.si)
      const url = `${s.publicUrl}/api/voice/generated/${a.name}`
      if (await publiclyServed(url)) {
        parts.push({ play: url })
        seconds += a.seconds
        used = 'si'
        audio = a.name
      } else {
        note = `Sinhala audio made (${a.name}) but ${url} is not reachable, so Twilio couldn't play it; using English`
      }
    } catch (err) {
      note = `SinhalaVITS failed (${err.message}); using English`
    }
  }
  if (used === 'en' || s.lang === 'si+en') {
    if (used === 'si') parts.push({ pause: 1 })
    parts.push({ say: alert.en.main }, { pause: 1 }, { say: alert.en.recap })
    seconds += words.englishSeconds(`${alert.en.main} ${alert.en.recap}`) + 1
    if (used === 'si') used = 'si+en'
  }
  return { twiml: words.twiml(parts), timeLimit: Math.min(180, Math.ceil(seconds + 8 + s.trialExtra)), lang: used, audio, note }
}

// ---- finding who to warn ----

async function farmersWithPlace() {
  const r = await db.query(
    `SELECT farmer_id, full_name, phone, district, farm_latitude, farm_longitude
     FROM farmers WHERE is_active AND sms_enabled`
  )
  return r.rows
    .map((f) => ({ ...f, place: forecast.locate(f), to: toE164(f.phone) }))
    .filter((f) => f.place && f.to)
}

// [{ farmer, alert }] for storms; alert carries the key, the stored fields and both languages
async function weatherAlerts({ simulate, summary }) {
  const t = forecast.thresholds()
  summary.thresholds.weather = t
  const farmers = await farmersWithPlace()

  // one forecast per ~10 km cell, not per farmer
  const cells = new Map()
  for (const f of farmers) {
    const key = forecast.cellOf(f.place)
    if (!cells.has(key)) cells.set(key, { place: f.place, farmers: [] })
    cells.get(key).farmers.push(f)
  }
  const list = [...cells.values()]
  if (!list.length) return []
  const dailies = await forecast.fetchForecasts(list.map((c) => c.place), { days: t.daysAhead + 1 })

  const out = []
  list.forEach((cell, i) => {
    const daily = dailies[i]
    if (!daily) return
    let storms = forecast.findStorms(daily, t)
    if (simulate && !storms.length) storms = [forecast.simulatedStorm(daily.time[0], t)]
    // the nearest storm only; a later one gets its own call on a later run
    const storm = storms[0]
    if (!storm) return
    summary.storms.push({ at: cell.place, ...storm, farmers: cell.farmers.length })
    const alert = {
      source: 'weather', key: `weather:${storm.start}`, subject: null,
      eventDate: storm.start, eventEnd: storm.end, kinds: storm.kinds,
      maxRain: storm.maxRain, maxGust: storm.maxGust, predictedPct: null, lead: storm.lead,
      en: words.weatherEnglish(storm), si: words.weatherSinhala(storm),
    }
    for (const f of cell.farmers) out.push({ farmer: f, alert })
  })
  return out
}

async function mlAlerts({ simulate, summary }) {
  const t = tanks.thresholds()
  summary.thresholds.ml = t
  const { outlooks, errors } = await tanks.tankOutlooks({ simulate })
  if (errors.length) summary.notes.push(`ML forecast unavailable for ${errors.length} tank(s): ${errors.slice(0, 3).join('; ')}`)

  const out = []
  for (const o of outlooks) {
    if (!tanks.isSpillRisk(o, t)) continue
    summary.tanks.push(o)
    const alert = {
      source: 'ml', key: `ml:${o.kind}:${o.id}:${o.targetDate}`, subject: o.name,
      eventDate: o.targetDate, eventEnd: o.targetDate, kinds: ['spill'],
      maxRain: null, maxGust: null, predictedPct: o.predictedPct, lead: o.horizon,
      en: words.tankEnglish(o), si: words.tankSinhala(o),
    }
    for (const f of await tanks.farmersOf(o)) {
      const to = toE164(f.phone)
      if (to) out.push({ farmer: { ...f, to }, alert })
    }
  }
  return out
}

// keys of alerts this farmer has effectively had already
async function alreadyHad(farmerIds) {
  if (!farmerIds.length) return []
  const { repeatDays } = tanks.thresholds()
  const r = await db.query(
    `SELECT farmer_id, source, subject, event_date::text AS event_date, called_at
     FROM storm_calls
     WHERE farmer_id = ANY($1::uuid[]) AND status = 'called'
       AND (source = 'weather' AND event_date >= CURRENT_DATE - 2
            OR source = 'ml' AND called_at > now() - make_interval(days => $2))`,
    [farmerIds, repeatDays]
  )
  return r.rows
}

// a storm the forecast moves by a day, or a tank already warned about this week, isn't rung again
function covered(had, farmerId, alert) {
  const day = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86400000
  return had.some((h) => h.farmer_id === farmerId && h.source === alert.source && (
    alert.source === 'weather' ? Math.abs(day(h.event_date) - day(alert.eventDate)) <= 1 : h.subject === alert.subject
  ))
}

function alertsForRun(alerts, had) {
  const rung = new Set()
  return alerts.filter(({ farmer, alert }) => {
    if (covered(had, farmer.farmer_id, alert) || rung.has(farmer.farmer_id)) return false
    rung.add(farmer.farmer_id)
    return true
  })
}

// ---- storing ----

const COLS = `(farmer_id, phone, source, alert_key, subject, event_date, event_end, kinds, max_rain_mm, max_gust_kmh,
               predicted_pct, lead_days, mode, status, error, attempts)`
const vals = (f, a, mode, status, error, attempts) =>
  [f.farmer_id, f.to, a.source, a.key, a.subject, a.eventDate, a.eventEnd, a.kinds, a.maxRain, a.maxGust, a.predictedPct, a.lead, mode, status, error, attempts]

// a row that is only a record (dry_run / skipped_trial / outside_hours); never overwrites a real attempt
async function record(f, a, status, mode, error = null) {
  await db.query(
    `INSERT INTO storm_calls ${COLS} VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (farmer_id, alert_key) DO UPDATE SET status = EXCLUDED.status, mode = EXCLUDED.mode,
       error = EXCLUDED.error, lead_days = EXCLUDED.lead_days, updated_at = now()
     WHERE storm_calls.status IN ('dry_run', 'skipped_trial', 'outside_hours')`,
    vals(f, a, mode, status, error, 0)
  )
}

// marks the call as being placed before placing it, so two api instances never both ring
async function claim(f, a, mode) {
  const r = await db.query(
    `INSERT INTO storm_calls ${COLS} VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (farmer_id, alert_key) DO UPDATE SET status = 'calling', mode = EXCLUDED.mode,
       attempts = storm_calls.attempts + 1, error = NULL, lead_days = EXCLUDED.lead_days, updated_at = now()
     WHERE storm_calls.status IN ('dry_run', 'skipped_trial', 'outside_hours')
        OR (storm_calls.status = 'failed' AND storm_calls.attempts < ${MAX_ATTEMPTS})
     RETURNING id`,
    vals(f, a, mode, 'calling', null, 1)
  )
  return r.rows[0]?.id || null
}

// ---- the run ----

/**
 * One pass. Options:
 *   dryRun   force dry-run whatever STORM_CALL_MODE says (the admin "preview" button)
 *   simulate pretend there's a storm STORM_DAYS_AHEAD days away and every linked tank will spill
 *   sources  ['weather', 'ml'] by default (STORM_CALL_SOURCES)
 *   now      for tests
 */
async function checkStorms({ dryRun = false, simulate = false, sources, now = new Date() } = {}) {
  const s = settings()
  const mode = dryRun ? 'dry-run' : s.mode
  const use = (sources || s.sources).filter((x) => SOURCES.includes(x))
  const summary = {
    mode, lang: s.lang, simulate, sources: use, thresholds: {}, storms: [], tanks: [],
    called: 0, failed: 0, skipped: 0, wouldCall: 0, calls: [], notes: [],
  }

  if (mode === 'off') return { ...summary, notes: ['STORM_CALL_MODE is off'] }
  if (!dryRun && !(await callsOn())) return { ...summary, notes: ['storm calls are switched off in the admin portal'] }

  // weather first: when a farmer has both, the nearer danger is rung now, the other next run
  let alerts = []
  for (const src of use) {
    try {
      alerts = alerts.concat(src === 'weather' ? await weatherAlerts({ simulate, summary }) : await mlAlerts({ simulate, summary }))
    } catch (err) {
      summary.notes.push(`${src} check failed: ${err.message}`)
      logger.error(`storm calls: ${src} check failed: ${err.message}`)
    }
  }
  if (!alerts.length) return summary

  const realCalls = mode === 'trial' || mode === 'live'
  const twilioOk = twilioConfigured()
  const inHours = (() => { const h = colomboHour(now); return h >= s.firstHour && h < s.lastHour })()
  if (realCalls && !twilioOk) summary.notes.push('Twilio is not set up, so calls are only recorded')
  if (realCalls && !inHours) summary.notes.push(`outside calling hours (${s.firstHour}:00-${s.lastHour}:00), calls wait for the next run`)

  const had = await alreadyHad([...new Set(alerts.map((x) => x.farmer.farmer_id))])
  const built = new Map()
  const build = async (a) => {
    if (!built.has(a.key)) built.set(a.key, buildCall(a, s))
    return built.get(a.key)
  }
  let placed = 0

  for (const { farmer: f, alert: a } of alertsForRun(alerts, had)) {
    if (!realCalls || !twilioOk) {
      // still make the audio, so the dry run's file is the one a live run plays
      const call = await build(a)
      await record(f, a, 'dry_run', mode)
      summary.wouldCall++
      summary.calls.push({ to: f.to, source: a.source, key: a.key, status: 'dry_run', lang: call.lang, audio: call.audio })
      continue
    }
    if (mode === 'trial' && !s.verified.has(f.to)) {
      await record(f, a, 'skipped_trial', mode, 'not a verified number on the Twilio trial')
      summary.skipped++
      continue
    }
    if (!inHours) {
      await record(f, a, 'outside_hours', mode)
      summary.skipped++
      continue
    }
    if (placed >= s.maxPerRun) {
      summary.notes.push(`reached STORM_CALL_MAX_PER_RUN (${s.maxPerRun}); the rest are rung next run`)
      break
    }

    const call = await build(a)
    const id = await claim(f, a, mode)
    if (!id) continue
    placed++
    try {
      const sid = await placeCall({ to: f.to, twiml: call.twiml, timeLimit: call.timeLimit })
      await db.query(`UPDATE storm_calls SET status = 'called', call_sid = $2, lang = $3, called_at = now(), updated_at = now() WHERE id = $1`, [id, sid, call.lang])
      summary.called++
      summary.calls.push({ to: f.to, source: a.source, key: a.key, status: 'called', sid, lang: call.lang })
      logger.info(`warning call (${a.key}, ${call.lang}) to ${f.to}: ${sid}`)
    } catch (err) {
      await db.query(`UPDATE storm_calls SET status = 'failed', error = $2, updated_at = now() WHERE id = $1`, [id, err.message.slice(0, 500)])
      summary.failed++
      logger.error(`warning call to ${f.to} failed: ${err.message}`)
      if (err.fatal) {
        summary.notes.push(`stopped: ${err.message}`)
        break
      }
    }
    // Twilio's default limit is one new call a second
    await new Promise((r) => setTimeout(r, 1100))
  }

  for (const c of await Promise.all(built.values())) if (c.note && !summary.notes.includes(c.note)) summary.notes.push(c.note)
  logger.info(`warning calls (${mode}${simulate ? ', simulated' : ''}): ${summary.storms.length} storm area(s), ` +
    `${summary.tanks.length} tank(s) to spill; ${summary.called} called, ${summary.failed} failed, ` +
    `${summary.skipped} skipped, ${summary.wouldCall} dry run`)
  return summary
}

function startStormCallJob() {
  if (settings().mode === 'off') {
    logger.info('storm call job off (STORM_CALL_MODE=off)')
    return null
  }
  const run = () => checkStorms().catch((err) => logger.error(`storm call job failed: ${err.message}`))
  setTimeout(run, 60000 + Math.floor(Math.random() * 30000))
  return setInterval(run, EVERY_MS)
}

module.exports = { startStormCallJob, checkStorms, callsOn, settings, buildCall, covered, alertsForRun }
