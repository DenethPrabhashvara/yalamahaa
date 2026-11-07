// Fills in the irrigation scheme each farm pin falls in (farms.scheme_*), from the Irrigation
// Department's "Irrigable area" layer, the same one the farmer portal map shows.
// Runs every 5 minutes and right after a farm is saved (nudgeSchemeJob). It only looks up
// farms that are new or whose pin moved, one request each, so ArcGIS sees very little traffic.
// If the layer is down, nothing is marked checked and the next run tries again.
const db = require('../config/db.js')
const logger = require('../utils/logger.js')

const LAYER = process.env.IRRIGABLE_AREA_LAYER ||
  'https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/Scheme_Data_2/FeatureServer/9'
const EVERY_MS = 5 * 60 * 1000
const NUDGE_MS = 3000        // after a save, give the transaction time to commit
const TIMEOUT_MS = 15000
const PER_RUN = 25

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

// A scheme's irrigable area is many separate paddy tracts, so a pin dropped on the farmer's house
// or a track beside the field can fall between them. Exact hit first, else the nearest tract
// within NEAR_M (distance_m says which; 0 = pin inside the tract).
const NEAR_M = 300

async function query(params) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${LAYER}/query?${new URLSearchParams({
      geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'Scheme,Type,Division,Irrig_Area_SchemeRegister_ha', f: 'json', ...params,
    })}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if (body.error || !Array.isArray(body.features)) throw new Error(body.error?.message || 'bad response')
    return body.features.filter((f) => text(f.attributes?.Scheme))
  } finally {
    clearTimeout(timer)
  }
}

// metres from (lat, lng) to the nearest edge of an esri polygon in WGS84
function distanceToRings(lat, lng, rings) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180)
  const ky = 110540
  let best = Infinity
  for (const ring of rings || []) {
    for (let i = 1; i < ring.length; i++) {
      const ax = (ring[i - 1][0] - lng) * kx, ay = (ring[i - 1][1] - lat) * ky
      const bx = (ring[i][0] - lng) * kx, by = (ring[i][1] - lat) * ky
      const dx = bx - ax, dy = by - ay
      const len = dx * dx + dy * dy
      const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
    }
  }
  return best
}

const hectares = (a) => (Number(a.Irrig_Area_SchemeRegister_ha) > 0 ? Math.round(Number(a.Irrig_Area_SchemeRegister_ha) * 100) / 100 : null)

function scheme(a, distance) {
  return { name: text(a.Scheme), type: text(a.Type), division: text(a.Division), irrigable_ha: hectares(a), distance_m: distance }
}

// null = no scheme at or within NEAR_M of the point. Throws if the layer can't be reached.
async function schemeAt(lat, lng) {
  const geometry = `${lng},${lat}`
  const exact = await query({ geometry, returnGeometry: 'false' })
  if (exact.length) {
    // overlapping areas: the smallest is the most specific
    const a = exact.map((f) => f.attributes).sort((x, y) => (hectares(x) ?? Infinity) - (hectares(y) ?? Infinity))[0]
    return scheme(a, 0)
  }
  const near = await query({
    geometry, distance: String(NEAR_M), units: 'esriSRUnit_Meter',
    returnGeometry: 'true', outSR: '4326', maxAllowableOffset: '0.00005',
  })
  let best = null
  for (const f of near) {
    const d = distanceToRings(lat, lng, f.geometry?.rings)
    if (d <= NEAR_M && (!best || d < best.d)) best = { d, a: f.attributes }
  }
  return best ? scheme(best.a, Math.round(best.d)) : null
}

async function fillSchemes() {
  // a removed pin clears the scheme
  await db.query(
    `UPDATE farms fm SET scheme_name = NULL, scheme_type = NULL, scheme_division = NULL, scheme_irrigable_ha = NULL,
            scheme_distance_m = NULL, scheme_checked_lat = NULL, scheme_checked_lng = NULL, scheme_checked_at = NULL
     FROM farmers f
     WHERE f.farm_id = fm.farm_id AND f.farm_latitude IS NULL AND fm.scheme_checked_lat IS NOT NULL`
  )
  const todo = await db.query(
    `SELECT fm.farm_id, f.farm_latitude AS lat, f.farm_longitude AS lng
     FROM farms fm JOIN farmers f ON f.farm_id = fm.farm_id
     WHERE f.farm_latitude IS NOT NULL AND f.farm_longitude IS NOT NULL
       AND (fm.scheme_checked_lat IS DISTINCT FROM f.farm_latitude OR fm.scheme_checked_lng IS DISTINCT FROM f.farm_longitude)
     ORDER BY fm.updated_at DESC
     LIMIT ${PER_RUN}`
  )
  let done = 0
  for (const row of todo.rows) {
    const s = await schemeAt(Number(row.lat), Number(row.lng))   // throws if the layer is down: stop, retry next run
    // only if the pin is still the one we looked up (the farmer may have moved it meanwhile)
    await db.query(
      `UPDATE farms fm SET scheme_name = $4, scheme_type = $5, scheme_division = $6, scheme_irrigable_ha = $7,
              scheme_distance_m = $8, scheme_checked_lat = $2, scheme_checked_lng = $3, scheme_checked_at = now()
       FROM farmers f
       WHERE fm.farm_id = $1 AND f.farm_id = fm.farm_id AND f.farm_latitude = $2 AND f.farm_longitude = $3`,
      [row.farm_id, row.lat, row.lng, s?.name ?? null, s?.type ?? null, s?.division ?? null, s?.irrigable_ha ?? null, s?.distance_m ?? null]
    )
    done += 1
  }
  return done
}

let running = null
let again = false
let nudgeTimer = null

function run() {
  if (running) { again = true; return running }
  running = fillSchemes()
    .then((n) => { if (n) logger.info(`irrigation scheme looked up for ${n} farm(s)`) })
    .catch((err) => logger.error(`irrigation scheme job failed: ${err.message}`))
    .finally(() => {
      running = null
      if (again) { again = false; run() }
    })
  return running
}

// call after saving a farm: looks it up within seconds instead of at the next 5-minute run
function nudgeSchemeJob() {
  clearTimeout(nudgeTimer)
  nudgeTimer = setTimeout(run, NUDGE_MS)
  nudgeTimer.unref?.()   // never keeps a script (or a test) running just for this
}

function startSchemeJob() {
  run()
  return setInterval(run, EVERY_MS)
}

module.exports = { startSchemeJob, nudgeSchemeJob, fillSchemes, schemeAt, distanceToRings, NEAR_M }
