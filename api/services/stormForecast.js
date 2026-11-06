// Finds dangerous weather up to a few days ahead in the Open-Meteo daily forecast.
// Used by services/stormCallJob.js; the words of the call are in services/alertMessages.js.
// Pure apart from fetchForecasts(): no database.

const OPEN_METEO = process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast'
const TIMEOUT_MS = 20000
// Open-Meteo takes many points in one request; keep each URL a sensible length
const POINTS_PER_REQUEST = 50

// Farmers without a farm pin are placed at their district's main town.
const DISTRICT_CENTRES = {
  Ampara: [7.29, 81.67], Anuradhapura: [8.31, 80.40], Badulla: [6.99, 81.06], Batticaloa: [7.73, 81.70],
  Colombo: [6.93, 79.86], Galle: [6.05, 80.22], Gampaha: [7.09, 79.99], Hambantota: [6.12, 81.12],
  Jaffna: [9.66, 80.02], Kalutara: [6.58, 79.96], Kandy: [7.29, 80.63], Kegalle: [7.25, 80.35],
  Kilinochchi: [9.39, 80.40], Kurunegala: [7.49, 80.36], Mannar: [8.98, 79.90], Matale: [7.47, 80.62],
  Matara: [5.95, 80.54], Monaragala: [6.87, 81.35], Mullaitivu: [9.27, 80.81], 'Nuwara Eliya': [6.97, 80.78],
  Polonnaruwa: [7.94, 81.00], Puttalam: [8.04, 79.83], Ratnapura: [6.68, 80.40], Trincomalee: [8.59, 81.21],
  Vavuniya: [8.75, 80.50],
}

// What counts as dangerous. Defaults follow the Met Department's wording:
// 100 mm in a day is "very heavy" rain, gusts from about 70 km/h are "strong winds".
function thresholds(env = process.env) {
  return {
    rainMm: Number(env.STORM_RAIN_MM) || 100,
    gustKmh: Number(env.STORM_GUST_KMH) || 70,
    // ignore a big rain total the model itself isn't sure of
    minRainProbability: env.STORM_MIN_RAIN_PROBABILITY === undefined ? 60 : Number(env.STORM_MIN_RAIN_PROBABILITY),
    daysAhead: Number(env.STORM_DAYS_AHEAD) || 4,
  }
}

// farm pin if there is one, otherwise the district centre, otherwise null (can't be forecast)
function locate(farmer) {
  if (farmer.farm_latitude != null && farmer.farm_longitude != null) {
    return { lat: Number(farmer.farm_latitude), lng: Number(farmer.farm_longitude) }
  }
  const c = DISTRICT_CENTRES[farmer.district]
  return c ? { lat: c[0], lng: c[1] } : null
}

// farmers within ~10 km share one forecast point
function cellOf({ lat, lng }) {
  const r = (v) => (Math.round(v * 10) / 10).toFixed(1)
  return `${r(lat)},${r(lng)}`
}

// one day's numbers -> null if it's fine, or what makes it dangerous
function classifyDay(day, t) {
  const kinds = []
  const rainLikely = day.probability == null || day.probability >= t.minRainProbability
  if (day.rain != null && day.rain >= t.rainMm && rainLikely) kinds.push('rain')
  if (day.gust != null && day.gust >= t.gustKmh) kinds.push('wind')
  return kinds.length ? kinds : null
}

const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000)

/**
 * Dangerous days 1..daysAhead from today, grouped into storms (a run of back-to-back bad days).
 * daily is Open-Meteo's `daily` object; today defaults to its first date, which Open-Meteo
 * gives in the requested time zone (Asia/Colombo).
 */
function findStorms(daily, t, today = daily.time[0]) {
  const storms = []
  daily.time.forEach((date, i) => {
    const lead = dayNumber(date) - dayNumber(today)
    if (lead < 1 || lead > t.daysAhead) return
    const day = {
      rain: daily.precipitation_sum?.[i],
      gust: daily.wind_gusts_10m_max?.[i],
      probability: daily.precipitation_probability_max?.[i],
    }
    const kinds = classifyDay(day, t)
    if (!kinds) return
    const last = storms[storms.length - 1]
    if (last && dayNumber(date) - dayNumber(last.end) === 1) {
      last.end = date
      last.kinds = [...new Set([...last.kinds, ...kinds])]
      last.maxRain = Math.max(last.maxRain, day.rain ?? 0)
      last.maxGust = Math.max(last.maxGust, day.gust ?? 0)
    } else {
      storms.push({ start: date, end: date, lead, kinds, maxRain: day.rain ?? 0, maxGust: day.gust ?? 0 })
    }
  })
  return storms
}

// a made-up storm, for testing the whole chain when the weather is calm
function simulatedStorm(today, t) {
  const start = new Date(Date.parse(`${today}T00:00:00Z`) + t.daysAhead * 86400000).toISOString().slice(0, 10)
  return { start, end: start, lead: t.daysAhead, kinds: ['rain', 'wind'], maxRain: 150, maxGust: 85, simulated: true }
}

/** Daily forecasts for many points: returns an array of Open-Meteo `daily` objects, same order. */
async function fetchForecasts(points, { days = 5 } = {}) {
  const out = []
  for (let i = 0; i < points.length; i += POINTS_PER_REQUEST) {
    const chunk = points.slice(i, i + POINTS_PER_REQUEST)
    const qs = new URLSearchParams({
      latitude: chunk.map((p) => p.lat).join(','),
      longitude: chunk.map((p) => p.lng).join(','),
      daily: 'precipitation_sum,wind_gusts_10m_max,precipitation_probability_max',
      forecast_days: String(days),
      timezone: 'Asia/Colombo',
    })
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(`${OPEN_METEO}?${qs}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`)
      const body = await res.json()
      // one point comes back as an object, several as an array
      for (const loc of Array.isArray(body) ? body : [body]) out.push(loc.daily)
    } finally {
      clearTimeout(timer)
    }
  }
  return out
}

module.exports = {
  DISTRICT_CENTRES, thresholds, locate, cellOf, classifyDay, findStorms, simulatedStorm,
  fetchForecasts,
}
