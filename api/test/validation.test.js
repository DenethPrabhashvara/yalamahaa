// Unit tests for the request checks behind PUT /api/auth/farm, PATCH /api/auth/profile and registration:
// validateFarm / cropSummary (farmService.js), validateFarmerChanges / hashNic (userService.js)
// and checkBoundary / nearPin (fieldShape.js). No database is used.
const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../config/db.js')
const { validateFarm, cropSummary } = require('../services/farmService.js')
const { validateFarmerChanges, hashNic } = require('../services/userService.js')
const { checkBoundary, nearPin } = require('../services/fieldShape.js')

test.after(() => db.pool.end().catch(() => {}))

const crop = (extra = {}) => ({ category: 'paddy', crop_type: '3.5 months', variety: 'Bg 352', acres: 2, last_yield: null, yield_unit: 'kg', ...extra })
// about 100 m x 100 m (2.47 acres) near Polonnaruwa, open ring as the portal sends it closed
const field = (lng = 80.98, lat = 8.05, d = 0.0009) => ({ type: 'Polygon', coordinates: [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]] })

// ---- validateFarm

test('validateFarm: the edit screen\'s full payload is accepted and cleaned', () => {
  const { error, farm } = validateFarm({
    water_source: 'tank', water_name: '  Kaudulla ', location_label: '1.2 km from Kaudulla',
    crops: [crop({ acres: '2.005', last_yield: '1800' })],
    total_acres: '14', boundary: field(), flood_history: 'once', flood_depth: 'knee', flood_last_year: 2024,
  }, { requireCrops: true })
  assert.equal(error, undefined)
  assert.equal(farm.water_name, 'Kaudulla')
  assert.equal(farm.crops[0].acres, 2.01)
  assert.equal(farm.crops[0].last_yield, 1800)
  assert.equal(farm.total_acres, 14)
  assert.deepEqual(farm.flood, { history: 'once', depth: 'knee', last_year: 2024 })
  assert.ok(Math.abs(farm.boundary.acres - 2.47) < 0.05, `boundary acres ${farm.boundary.acres}`)
})

test('validateFarm: crops are required on PUT, optional on register', () => {
  assert.equal(validateFarm({ water_source: 'tank' }, { requireCrops: true }).error, 'Add at least one crop.')
  assert.equal(validateFarm({ crops: [] }, { requireCrops: true }).error, 'Add at least one crop.')
  const { farm } = validateFarm({ water_source: 'well' })
  assert.equal(farm.crops, undefined)
})

test('validateFarm: rejects bad water source, too many crops and bad crop fields', () => {
  assert.match(validateFarm({ water_source: 'ocean', crops: [crop()] }).error, /water_source must be one of/)
  assert.match(validateFarm({ crops: Array.from({ length: 21 }, () => crop()) }).error, /at most 20 crops/)
  assert.match(validateFarm({ crops: [crop(), crop({ crop_type: ' ' })] }).error, /^Crop 2: crop_type is required/)
  for (const acres of [0, -1, 'abc', 100001, null]) {
    assert.match(validateFarm({ crops: [crop({ acres })] }).error, /acres must be a number above 0/, `acres ${acres}`)
  }
  assert.match(validateFarm({ crops: [crop({ last_yield: -5 })] }).error, /last_yield/)
  assert.match(validateFarm({ crops: [crop({ yield_unit: 'lbs' })] }).error, /yield_unit/)
})

test('validateFarm: empty yield is null, text is trimmed and capped', () => {
  const { farm } = validateFarm({ crops: [crop({ last_yield: '', variety: 'x'.repeat(200) })] })
  assert.equal(farm.crops[0].last_yield, null)
  assert.equal(farm.crops[0].variety.length, 80)
})

test('validateFarm: total_acres - only changed when sent; empty clears it; must be positive', () => {
  assert.equal('total_acres' in validateFarm({ crops: [crop()] }).farm, false)
  assert.equal(validateFarm({ total_acres: '' }).farm.total_acres, null)
  assert.equal(validateFarm({ total_acres: null }).farm.total_acres, null)
  assert.equal(validateFarm({ total_acres: '2.345' }).farm.total_acres, 2.35)
  for (const v of [0, -2, 'lots', 100001]) assert.match(validateFarm({ total_acres: v }).error, /total_acres/, `for ${v}`)
})

test('validateFarm: flood history rules', () => {
  // depth and year are dropped when the field never flooded
  assert.deepEqual(validateFarm({ flood_history: 'never', flood_depth: 'waist', flood_last_year: 2020 }).farm.flood,
    { history: 'never', depth: null, last_year: null })
  assert.deepEqual(validateFarm({ flood_history: null }).farm.flood, { history: null, depth: null, last_year: null })
  assert.match(validateFarm({ flood_history: 'sometimes' }).error, /flood_history must be one of/)
  assert.match(validateFarm({ flood_history: 'once', flood_depth: 'neck' }).error, /flood_depth/)
  assert.match(validateFarm({ flood_history: 'once', flood_last_year: new Date().getFullYear() + 1 }).error, /past year/)
  assert.match(validateFarm({ flood_history: 'once', flood_last_year: 1900 }).error, /past year/)
  assert.match(validateFarm({ flood_depth: 'knee' }).error, /Send flood_history/)
})

test('cropSummary: total acres rounded, first crop is the primary one', () => {
  assert.deepEqual(cropSummary([{ acres: 0.1, crop_type: 'A' }, { acres: 0.2, crop_type: 'B' }]), { land_acres: 0.3, primary_crop: 'A' })
})

// ---- checkBoundary / nearPin

test('checkBoundary: closes the ring, rounds corners and reports acres', () => {
  const open = { type: 'Polygon', coordinates: [field().coordinates[0].slice(0, -1).map(([x, y]) => [x + 1e-9, y])] }
  const r = checkBoundary(open)
  assert.equal(r.error, undefined)
  const ring = r.boundary.coordinates[0]
  assert.equal(ring.length, 5)
  assert.deepEqual(ring[0], ring[4])
  assert.equal(ring[0][0], 80.98)   // rounded to 7 decimals
})

test('checkBoundary: rejects bad shapes', () => {
  const ring = field().coordinates[0]
  assert.match(checkBoundary(null).error, /GeoJSON Polygon/)
  assert.match(checkBoundary({ type: 'Point', coordinates: [80, 8] }).error, /GeoJSON Polygon/)
  assert.match(checkBoundary({ type: 'Polygon', coordinates: [ring, ring] }).error, /without holes/)
  assert.match(checkBoundary({ type: 'Polygon', coordinates: [[[80.98, 8.05], [80.99, 8.05], [80.98, 8.05]]] }).error, /at least 3 corners/)
  assert.match(checkBoundary({ type: 'Polygon', coordinates: [[['80.98', 8.05], [80.99, 8.05], [80.99, 8.06]]] }).error, /numbers/)
  assert.match(checkBoundary(field(77.6, 12.9)).error, /in Sri Lanka/)   // Bengaluru
  // figure 8: corners in the order 1, 3, 2, 4
  const [a, b, c, d] = ring
  assert.match(checkBoundary({ type: 'Polygon', coordinates: [[a, c, b, d]] }).error, /cross/)
  assert.match(checkBoundary(field(80.98, 8.05, 0.00001)).error, /too small/)
  assert.match(checkBoundary(field(80.98, 8.05, 0.2)).error, /larger than/)
})

test('nearPin: within 5 km of the pin, or no pin to compare with', () => {
  const b = checkBoundary(field()).boundary
  assert.equal(nearPin(b, { lat: 8.05, lng: 80.98 }), true)
  assert.equal(nearPin(b, { lat: 8.2, lng: 80.98 }), false)   // ~17 km north
  assert.equal(nearPin(b, null), true)
})

// ---- validateFarmerChanges / hashNic

test('validateFarmerChanges: the edit screen\'s profile payload passes', () => {
  const { error, changes } = validateFarmerChanges({
    full_name: ' Sunil Bandara ', address: 'No 12', district: 'Polonnaruwa', division: '  ', farm_latitude: 8.05, farm_longitude: 80.98,
    preferred_lang: 'ta', reservoir_id: 12, tank_id: null, land_acres: 2, primary_crop: '3.5 months', phone: '+94770000000',
  })
  assert.equal(error, undefined)
  assert.equal(changes.full_name, 'Sunil Bandara')
  assert.equal(changes.division, null)            // empty optional text -> null
  assert.equal(changes.preferred_lang, 'ta')
  assert.equal('phone' in changes, false)         // farmers can't change their phone here
})

test('validateFarmerChanges: rejects empty names, non-numbers, both water links and non-boolean SMS', () => {
  assert.match(validateFarmerChanges({ full_name: '  ' }).error, /full_name cannot be empty/)
  assert.match(validateFarmerChanges({ district: 5 }).error, /district cannot be empty/)
  assert.match(validateFarmerChanges({ division: 5 }).error, /division must be text/)
  assert.match(validateFarmerChanges({ farm_latitude: 'north' }).error, /farm_latitude must be a number/)
  assert.match(validateFarmerChanges({ reservoir_id: 1, tank_id: 2 }).error, /not both/)
  assert.match(validateFarmerChanges({ sms_enabled: 'yes' }).error, /sms_enabled/)
  assert.match(validateFarmerChanges({ preferred_lang: 'fr' }).error, /preferred_lang/)
  assert.deepEqual(validateFarmerChanges({ sms_enabled: false }).changes, { sms_enabled: false })
})

test('hashNic: same NIC in any case / spacing gives the same hash; needs the pepper', () => {
  const saved = process.env.NIC_PEPPER
  try {
    process.env.NIC_PEPPER = 'test-pepper'
    assert.equal(hashNic(' 821453298v '), hashNic('821453298V'))
    assert.notEqual(hashNic('821453298V'), hashNic('821453299V'))
    assert.match(hashNic('198421098456'), /^[0-9a-f]{64}$/)
    delete process.env.NIC_PEPPER
    assert.throws(() => hashNic('821453298V'), /NIC_PEPPER/)
  } finally {
    if (saved === undefined) delete process.env.NIC_PEPPER
    else process.env.NIC_PEPPER = saved
  }
})
