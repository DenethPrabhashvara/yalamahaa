const test = require('node:test')
const assert = require('node:assert')
const t = require('../services/tankForecastAlerts.js')

const th = t.thresholds({})

test('portal usable % is preferred over the model fill', () => {
  const o = t.outlookFrom('reservoir', 1, 'Minneriya', {
    fill_now: 0.8, predicted_fill_in_14d: 0.9, usable_now_pct: 95, usable_predicted_pct: 102,
    outlook: 'rising', from_date: '2026-11-06', target_date: '2026-11-20', horizon_days: 14,
  })
  assert.deepStrictEqual([o.nowPct, o.predictedPct, o.targetDate, o.horizon], [95, 102, '2026-11-20', 14])
  const m = t.outlookFrom('tank', 2, 'X', { fill_now: 0.9, predicted_fill_in_14d: 1.05, outlook: 'rising', horizon_days: 14 })
  assert.strictEqual(Math.round(m.predictedPct), 105)
})

test('spill risk', () => {
  assert.ok(t.isSpillRisk({ predictedPct: 100, outlook: 'rising' }, th))
  assert.ok(t.isSpillRisk({ predictedPct: 110, outlook: 'steady' }, th))
  assert.ok(!t.isSpillRisk({ predictedPct: 99.9, outlook: 'rising' }, th))
  assert.ok(!t.isSpillRisk({ predictedPct: 105, outlook: 'falling' }, th))
})
