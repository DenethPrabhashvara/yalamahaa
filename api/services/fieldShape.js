// Field boundary maths for farms.boundary (a GeoJSON Polygon the farmer draws on the map).
// Fields are small, so a flat projection around the field is accurate to well under 1%.
// The farmer portal has the same functions in farmerportal/src/fieldShape.js.

const M2_PER_ACRE = 4046.8564224
const EARTH_M = 6371008.8

// Sri Lanka with some sea around it
const BOUNDS = { minLat: 5.7, maxLat: 10.1, minLng: 79.3, maxLng: 82.2 }
const MIN_CORNERS = 3
const MAX_CORNERS = 60
const MIN_ACRES = 0.01        // about 40 m2
const MAX_ACRES = 5000
const MAX_KM_FROM_PIN = 5

// [[lng, lat], ...] -> metres east / north of the first corner
function toMetres(ring) {
  const lat0 = (ring[0][1] * Math.PI) / 180
  const k = (Math.PI / 180) * EARTH_M
  return ring.map(([lng, lat]) => [(lng - ring[0][0]) * k * Math.cos(lat0), (lat - ring[0][1]) * k])
}

function areaM2(ring) {
  const p = toMetres(ring)
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]
    const [x2, y2] = p[(i + 1) % p.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

// true if two edges that don't share a corner cross (a figure-8 field)
function selfIntersects(ring) {
  const p = toMetres(ring)
  const n = p.length
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || j === (i + 1) % n) continue   // neighbouring edges share a corner
      const c = p[j], d = p[(j + 1) % n]
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true
    }
  }
  return false
}

function centre(ring) {
  const n = ring.length
  return { lng: ring.reduce((s, c) => s + c[0], 0) / n, lat: ring.reduce((s, c) => s + c[1], 0) / n }
}

function km(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return (2 * EARTH_M * Math.asin(Math.sqrt(h))) / 1000
}

// returns { error } or { boundary, acres } with the ring closed and rounded to ~1 cm
function checkBoundary(value) {
  if (!value || value.type !== 'Polygon' || !Array.isArray(value.coordinates) || !Array.isArray(value.coordinates[0])) {
    return { error: 'boundary must be a GeoJSON Polygon.' }
  }
  if (value.coordinates.length !== 1) return { error: 'boundary must be a single field without holes.' }

  let ring = value.coordinates[0]
  if (!ring.every((c) => Array.isArray(c) && c.length >= 2 && c.slice(0, 2).every((v) => typeof v === 'number' && Number.isFinite(v)))) {
    return { error: 'boundary corners must be [longitude, latitude] numbers.' }
  }
  ring = ring.map(([lng, lat]) => [Math.round(lng * 1e7) / 1e7, Math.round(lat * 1e7) / 1e7])
  const [f, l] = [ring[0], ring[ring.length - 1]]
  if (ring.length > 1 && f[0] === l[0] && f[1] === l[1]) ring = ring.slice(0, -1)   // stored closed, checked open

  if (ring.length < MIN_CORNERS) return { error: `Mark at least ${MIN_CORNERS} corners of the field.` }
  if (ring.length > MAX_CORNERS) return { error: `A field boundary can have at most ${MAX_CORNERS} corners.` }
  if (!ring.every(([lng, lat]) => lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng)) {
    return { error: 'The field boundary must be in Sri Lanka.' }
  }
  if (selfIntersects(ring)) return { error: 'The field boundary lines cross each other. Move or remove a corner.' }

  const acres = areaM2(ring) / M2_PER_ACRE
  if (acres < MIN_ACRES) return { error: 'The field boundary is too small. Mark the corners of the whole field.' }
  if (acres > MAX_ACRES) return { error: `The field boundary is larger than ${MAX_ACRES} acres.` }

  return {
    boundary: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
    acres: Math.round(acres * 100) / 100
  }
}

// the boundary has to be around the farm pin, not somewhere else on the map
function nearPin(boundary, pin) {
  if (!pin || pin.lat == null || pin.lng == null) return true
  return km(centre(boundary.coordinates[0].slice(0, -1)), { lat: Number(pin.lat), lng: Number(pin.lng) }) <= MAX_KM_FROM_PIN
}

module.exports = { checkBoundary, nearPin, areaM2, selfIntersects, M2_PER_ACRE, MAX_KM_FROM_PIN }
