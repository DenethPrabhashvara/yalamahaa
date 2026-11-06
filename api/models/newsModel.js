const db = require('../config/db.js')
const { canonDistrict } = require('../services/slPlaces.js')

const LANGS = new Set(['en', 'si', 'ta'])
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

// Official weather warnings for the farmer portal's news section, filled by
// services/weatherFeedJob.js. Public, like /api/data/rivers: these are public-safety
// notices and the district arrives as a query parameter, so there is no auth here.
//
//   GET /api/data/news?lang=en|si|ta&district=Polonnaruwa&all=1&limit=20
//
// Without `all`, a district filters the list to warnings that name it (plus island-wide
// ones). The filter deliberately FAILS OPEN on an advisory we couldn't match to any
// district: better a farmer sees a warning for somewhere else than misses a cyclone
// because the feed changed the shape of its area text.
exports.getNews = async (req, res, next) => {
  try {
    const lang = LANGS.has(req.query.lang) ? req.query.lang : 'en'
    const all = req.query.all === '1' || req.query.all === 'true'
    const district = !all && req.query.district ? canonDistrict(String(req.query.district).slice(0, 60)) : null
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(req.query.limit) || DEFAULT_LIMIT))

    // The 48-hour tail lets the news page show just-ended warnings greyed out; the
    // banner and the home card filter on expires themselves.
    const params = [lang]
    let where = `a.status = 'Actual' AND a.scope = 'Public'
                 AND (a.expires IS NULL OR a.expires > NOW() - INTERVAL '48 hours')`
    if (district) {
      params.push(district)
      where += ` AND (a.all_island OR a.districts = '{}' OR a.districts && ARRAY[$${params.length}])`
    }
    params.push(limit)

    const r = await db.query(
      `SELECT a.id, a.identifier, a.sent, a.expires, a.event AS event_en, a.severity, a.urgency,
              a.certainty, a.colour, a.is_cyclone, a.banner, a.tone, a.districts, a.divisions,
              a.all_island, a.web, a.source,
              (a.expires IS NOT NULL AND a.expires <= NOW()) AS expired,
              tx.lang AS text_lang, tx.event, tx.headline, tx.description, tx.instruction, tx.area_desc
       FROM weather_advisories a
       LEFT JOIN LATERAL (
         SELECT t.lang, t.event, t.headline, t.description, t.instruction, t.area_desc
         FROM weather_advisory_texts t
         WHERE t.advisory_id = a.id
         ORDER BY (t.lang = $1) DESC, (t.lang = 'en') DESC
         LIMIT 1
       ) tx ON true
       WHERE ${where}
       -- Live before ended first of all: a finished cyclone must never outrank a warning
       -- that is still in force. Only then does banner-worthiness lead.
       ORDER BY (a.expires IS NULL OR a.expires > NOW()) DESC, a.banner DESC, a.sent DESC
       LIMIT $${params.length}`,
      params
    )

    const news = r.rows.map((row) => ({
      id: row.identifier,
      event: row.event || row.event_en,
      eventEn: row.event_en,
      headline: row.headline || row.event_en,
      body: row.description,
      instruction: row.instruction,
      severity: row.severity,
      urgency: row.urgency,
      certainty: row.certainty,
      colour: row.colour,
      tone: row.tone,
      cyclone: row.is_cyclone,
      banner: row.banner,
      sent: row.sent,
      expires: row.expires,
      expired: row.expired,
      areas: {
        districts: row.districts || [],
        divisions: row.divisions || [],
        allIsland: row.all_island,
        text: row.area_desc,
      },
      web: row.web,
      source: row.source,
      lang: row.text_lang || lang,
      // Tells the page to mark the item as being shown in English when the feed hadn't
      // published this farmer's language yet.
      langFallback: Boolean(row.text_lang && row.text_lang !== lang),
    }))

    res.status(200).json({ status: 'success', data: news })
  } catch (err) {
    // A missing table or an empty feed must read as "no news", not as a 500: the global
    // handler would turn it into an error the farmer sees instead of their home screen.
    if (err.code === '42P01') return res.status(200).json({ status: 'success', data: [] })
    next(err)
  }
}
