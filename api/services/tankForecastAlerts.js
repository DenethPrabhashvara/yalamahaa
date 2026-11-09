// Tanks the ML model (ml-model/, via models/forecastModel.js) expects to fill and spill within its
// horizon (14 days), for the warning calls in services/stormCallJob.js.
// Only tanks / reservoirs that some active farmer is linked to are forecast.
const db = require('../config/db.js')
const forecastModel = require('../models/forecastModel.js')

function thresholds(env = process.env) {
  return {
    // predicted fill, as % of the tank's capacity, from which it counts as spilling
    spillPct: Number(env.ML_SPILL_PCT) || 100,
    // after a call, the same tank's farmers aren't rung again for this many days
    repeatDays: Number(env.ML_REPEAT_DAYS) || 7,
  }
}

// runs a forecast route handler and hands back what it would have sent
function capture(handler, id) {
  return new Promise((resolve, reject) => {
    const res = {
      code: 200,
      status(c) { this.code = c; return this },
      json(body) { resolve({ code: this.code, body }); return this },
    }
    Promise.resolve(handler({ params: { id: String(id) } }, res, reject)).catch(reject)
  })
}

// tanks and reservoirs active farmers with alerts on are linked to
async function linkedWaterBodies() {
  const r = await db.query(
    `SELECT 'reservoir' AS kind, f.reservoir_id AS id, rv.name
     FROM farmers f JOIN reservoirs rv ON rv.id = f.reservoir_id
     WHERE f.is_active AND f.sms_enabled
     UNION
     SELECT 'tank', f.tank_id, t.tank_name
     FROM farmers f JOIN mahawelitanks t ON t.id = f.tank_id
     WHERE f.is_active AND f.sms_enabled`
  )
  return r.rows
}

// the model's answer -> the numbers the alert needs. The portal's usable % (of active capacity)
// is used when there is one, so the call says what farmers see on screen.
function outlookFrom(kind, id, name, d) {
  const nowPct = d.usable_now_pct ?? d.fill_now * 100
  const predictedPct = d.usable_predicted_pct ?? d.predicted_fill_in_14d * 100
  return {
    kind, id, name, nowPct, predictedPct,
    outlook: d.outlook, fromDate: d.from_date, targetDate: d.target_date, horizon: d.horizon_days,
  }
}

function isSpillRisk(o, t) {
  return o.predictedPct >= t.spillPct && o.outlook !== 'falling'
}

/**
 * Forecast for every linked tank. Returns { outlooks, errors }.
 * simulate: tanks the model says are fine (or can't forecast) get a pretend spill, to test the chain.
 */
async function tankOutlooks({ simulate = false } = {}) {
  const bodies = await linkedWaterBodies()
  const outlooks = []
  const errors = []
  for (const b of bodies) {
    const handler = b.kind === 'reservoir' ? forecastModel.getForecastByReservoirId : forecastModel.getForecastByTankId
    let o = null
    try {
      const { code, body } = await capture(handler, b.id)
      if (code === 200 && body.data) o = outlookFrom(b.kind, b.id, b.name, body.data)
      else errors.push(`${b.name}: ${body.message || `HTTP ${code}`}`)
    } catch (err) {
      errors.push(`${b.name}: ${err.message}`)
    }
    if (simulate && (!o || !isSpillRisk(o, thresholds()))) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' })
      o = { kind: b.kind, id: b.id, name: b.name, nowPct: o?.nowPct ?? 92, predictedPct: 104, outlook: 'rising',
        fromDate: today, targetDate: today, horizon: 14, simulated: true }
    }
    if (o) outlooks.push(o)
  }
  return { outlooks, errors }
}

// active farmers with alerts on who take water from this tank / reservoir
async function farmersOf(o) {
  const col = o.kind === 'reservoir' ? 'reservoir_id' : 'tank_id'
  const r = await db.query(
    `SELECT farmer_id, full_name, phone, district, farm_latitude, farm_longitude
     FROM farmers WHERE is_active AND sms_enabled AND ${col} = $1`,
    [o.id]
  )
  return r.rows
}

module.exports = { thresholds, tankOutlooks, isSpillRisk, farmersOf, outlookFrom }
