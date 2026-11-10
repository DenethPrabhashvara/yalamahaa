// Unit tests for services/schemeJob.js: the irrigation scheme lookup for each farm pin.
// The ArcGIS layer (fetch) and the database (db.query) are replaced with fakes; nothing goes over the network.
const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../config/db.js')
const { schemeAt, fillSchemes, distanceToRings, NEAR_M } = require('../services/schemeJob.js')

// a square tract about 220 m a side, corners in [lng, lat]
const LAT = 8.0
const LNG = 80.9
const D = 0.002
const square = [[[LNG, LAT], [LNG + D, LAT], [LNG + D, LAT + D], [LNG, LAT + D], [LNG, LAT]]]
const M_PER_DEG_LAT = 110540

function fakeFetch(handler) {
  const calls = []
  global.fetch = async (url) => {
    const params = Object.fromEntries(new URL(url).searchParams)
    calls.push(params)
    const out = await handler(params, calls.length)
    if (out instanceof Error) throw out
    const { status = 200, body } = out
    return { ok: status >= 200 && status < 300, status, json: async () => body }
  }
  return calls
}

const feature = (attrs, rings) => ({ attributes: attrs, ...(rings ? { geometry: { rings } } : {}) })

test.afterEach(() => { delete global.fetch })

test('distanceToRings: 0 on an edge, the gap to the nearest edge outside', () => {
  assert.equal(Math.round(distanceToRings(LAT, LNG + D / 2, square)), 0)
  // 0.0005 deg of latitude south of the bottom edge
  const d = distanceToRings(LAT - 0.0005, LNG + D / 2, square)
  assert.ok(Math.abs(d - 0.0005 * M_PER_DEG_LAT) < 1, `got ${d}`)
  // beyond a corner the nearest point is the corner itself
  const c = distanceToRings(LAT - 0.0003, LNG - 0.0004, square)
  const kx = 111320 * Math.cos((LAT * Math.PI) / 180)
  assert.ok(Math.abs(c - Math.hypot(0.0004 * kx, 0.0003 * M_PER_DEG_LAT)) < 1, `got ${c}`)
})

test('distanceToRings: Infinity with no geometry', () => {
  assert.equal(distanceToRings(LAT, LNG, undefined), Infinity)
  assert.equal(distanceToRings(LAT, LNG, []), Infinity)
})

test('schemeAt: a pin inside a tract gets that scheme with distance 0, one request', async () => {
  const calls = fakeFetch(() => ({ body: { features: [feature({ Scheme: ' Minneriya ', Type: 'Major', Division: 'Polonnaruwa', Irrig_Area_SchemeRegister_ha: 9096.004 })] } }))
  const s = await schemeAt(LAT + D / 2, LNG + D / 2)
  assert.deepEqual(s, { name: 'Minneriya', type: 'Major', division: 'Polonnaruwa', irrigable_ha: 9096, distance_m: 0 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].geometry, `${LNG + D / 2},${LAT + D / 2}`)   // ArcGIS wants x,y = lng,lat
  assert.equal(calls[0].returnGeometry, 'false')
})

test('schemeAt: overlapping schemes pick the smallest (most specific) one', async () => {
  fakeFetch(() => ({ body: { features: [
    feature({ Scheme: 'Big', Irrig_Area_SchemeRegister_ha: 5000 }),
    feature({ Scheme: 'Small', Irrig_Area_SchemeRegister_ha: 40 }),
    feature({ Scheme: 'No area', Irrig_Area_SchemeRegister_ha: null }),
  ] } }))
  assert.equal((await schemeAt(LAT, LNG)).name, 'Small')
})

test('schemeAt: features without a scheme name are ignored', async () => {
  const calls = fakeFetch((p, n) => ({ body: { features: n === 1 ? [feature({ Scheme: '  ' })] : [] } }))
  assert.equal(await schemeAt(LAT, LNG), null)
  assert.equal(calls.length, 2)   // the blank one didn't count as a hit, so it searched nearby
})

test('schemeAt: no exact hit falls back to the nearest tract within NEAR_M', async () => {
  const far = [[[LNG + 0.01, LAT], [LNG + 0.012, LAT], [LNG + 0.012, LAT + D], [LNG + 0.01, LAT]]]
  const calls = fakeFetch((p, n) => ({ body: { features: n === 1 ? [] : [
    feature({ Scheme: 'Far', Irrig_Area_SchemeRegister_ha: 10 }, far),
    feature({ Scheme: 'Near', Irrig_Area_SchemeRegister_ha: 250 }, square),
  ] } }))
  const s = await schemeAt(LAT - 0.0008, LNG + D / 2)   // about 88 m south of the square
  assert.equal(s.name, 'Near')
  assert.ok(Math.abs(s.distance_m - 88) <= 1, `distance ${s.distance_m}`)
  assert.equal(calls[1].distance, String(NEAR_M))
  assert.equal(calls[1].returnGeometry, 'true')
})

test('schemeAt: a tract the server returns but that is really beyond NEAR_M is not used', async () => {
  fakeFetch((p, n) => ({ body: { features: n === 1 ? [] : [feature({ Scheme: 'Edge' }, square)] } }))
  assert.equal(await schemeAt(LAT - 0.004, LNG + D / 2), null)   // ~440 m away
})

test('schemeAt: irrigable area that is missing, zero or text becomes null', async () => {
  for (const ha of [null, 0, -3, 'n/a']) {
    fakeFetch(() => ({ body: { features: [feature({ Scheme: 'X', Irrig_Area_SchemeRegister_ha: ha })] } }))
    assert.equal((await schemeAt(LAT, LNG)).irrigable_ha, null, `for ${ha}`)
  }
})

test('schemeAt: throws when the layer is down, so the farm is retried next run', async () => {
  fakeFetch(() => ({ status: 503, body: {} }))
  await assert.rejects(schemeAt(LAT, LNG), /HTTP 503/)
  fakeFetch(() => ({ body: { error: { message: 'Invalid query' } } }))
  await assert.rejects(schemeAt(LAT, LNG), /Invalid query/)
  fakeFetch(() => new Error('network down'))
  await assert.rejects(schemeAt(LAT, LNG), /network down/)
})

// ---- fillSchemes with a fake database

function fakeDb(todo) {
  const queries = []
  db.query = async (sql, params) => {
    queries.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    if (/^SELECT/i.test(sql.trim())) return { rows: todo }
    return { rows: [], rowCount: 1 }
  }
  return queries
}
const realQuery = db.query
test.after(() => { db.query = realQuery; db.pool.end().catch(() => {}) })

test('fillSchemes: clears removed pins first, then looks up each farm and saves it', async () => {
  const queries = fakeDb([
    { farm_id: 'FAR-1', lat: '8.001', lng: '80.901' },
    { farm_id: 'FAR-2', lat: '8.500', lng: '81.200' },
  ])
  fakeFetch((p) => ({ body: { features: p.geometry === '80.901,8.001' && p.returnGeometry === 'false'
    ? [feature({ Scheme: 'Kaudulla', Type: 'Major', Division: 'Hingurakgoda', Irrig_Area_SchemeRegister_ha: 5869 })]
    : [] } }))
  const n = await fillSchemes()
  assert.equal(n, 2)
  assert.match(queries[0].sql, /^UPDATE farms fm SET scheme_name = NULL/)
  assert.match(queries[0].sql, /f\.farm_latitude IS NULL/)
  assert.match(queries[1].sql, /^SELECT fm\.farm_id/)
  const [save1, save2] = queries.slice(2)
  assert.deepEqual(save1.params, ['FAR-1', '8.001', '80.901', 'Kaudulla', 'Major', 'Hingurakgoda', 5869, 0])
  // no scheme: still saved (all null) with the pin it was checked for, so it isn't looked up again
  assert.deepEqual(save2.params, ['FAR-2', '8.500', '81.200', null, null, null, null, null])
  // only saved if the pin is still the one that was looked up
  assert.match(save1.sql, /f\.farm_latitude = \$2 AND f\.farm_longitude = \$3/)
})

test('fillSchemes: stops when the layer is down, without marking the farm checked', async () => {
  const queries = fakeDb([{ farm_id: 'FAR-1', lat: '8', lng: '81' }])
  fakeFetch(() => ({ status: 500, body: {} }))
  await assert.rejects(fillSchemes(), /HTTP 500/)
  assert.equal(queries.filter((q) => q.sql.includes('scheme_checked_at = now()')).length, 0)
})

test('fillSchemes: nothing to do', async () => {
  fakeDb([])
  const calls = fakeFetch(() => ({ body: { features: [] } }))
  assert.equal(await fillSchemes(), 0)
  assert.equal(calls.length, 0)
})
