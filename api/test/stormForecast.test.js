const test = require('node:test')
const assert = require('node:assert')
const f = require('../services/stormForecast.js')

const t = f.thresholds({})
const daily = (rain, gust = [], prob = []) => ({
  time: ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'],
  precipitation_sum: rain, wind_gusts_10m_max: gust, precipitation_probability_max: prob,
})

test('defaults', () => {
  assert.deepStrictEqual(t, { rainMm: 100, gustKmh: 70, minRainProbability: 60, daysAhead: 4 })
})

test('calm weather has no storm', () => {
  assert.deepStrictEqual(f.findStorms(daily([10, 20, 30, 40, 50, 60], [30, 30, 30, 30, 30, 30]), t), [])
})

test('heavy rain 4 days ahead is found with its lead time', () => {
  const s = f.findStorms(daily([0, 0, 0, 0, 140, 0]), t)
  assert.strictEqual(s.length, 1)
  assert.deepStrictEqual([s[0].start, s[0].lead, s[0].kinds, s[0].maxRain], ['2026-11-11', 4, ['rain'], 140])
})

test('today and beyond daysAhead are ignored', () => {
  assert.deepStrictEqual(f.findStorms(daily([200, 0, 0, 0, 0, 200]), t), [])
})

test('back-to-back bad days are one storm', () => {
  const s = f.findStorms(daily([0, 0, 120, 0, 0, 0], [0, 0, 40, 80, 0, 0]), t)
  assert.strictEqual(s.length, 1)
  assert.deepStrictEqual([s[0].start, s[0].end, s[0].kinds.sort(), s[0].maxGust], ['2026-11-09', '2026-11-10', ['rain', 'wind'], 80])
})

test('unlikely rain does not count', () => {
  assert.deepStrictEqual(f.findStorms(daily([0, 150, 0, 0, 0, 0], [], [0, 30, 0, 0, 0, 0]), t), [])
})

test('farmer without a pin falls back to the district centre', () => {
  assert.deepStrictEqual(f.locate({ district: 'Polonnaruwa' }), { lat: 7.94, lng: 81.0 })
  assert.deepStrictEqual(f.locate({ farm_latitude: '8.1', farm_longitude: '80.9', district: 'Polonnaruwa' }), { lat: 8.1, lng: 80.9 })
  assert.strictEqual(f.locate({ district: 'Nowhere' }), null)
})

test('every district has a centre', () => {
  const { DISTRICTS } = require('../services/slPlaces.js')
  for (const d of DISTRICTS) assert.ok(f.DISTRICT_CENTRES[d], d)
})
