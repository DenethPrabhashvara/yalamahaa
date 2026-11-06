const db = require('../config/db.js')

const ACFT_PER_MCM = 810.713
const FORECAST_API_URL = process.env.FORECAST_API_URL || 'http://localhost:5000'

// tank = the name the model was trained on (ml-model/model/meta.json)
// extend(fc) can add fields to the model's answer before it goes out
async function sendForecast(res, tank, rows, idField, extend = (fc) => fc) {
  const readings = rows.map(({ date, storage_acft }) => ({ date, storage_acft: Number(storage_acft) }))

  let fres
  try {
    fres = await fetch(`${FORECAST_API_URL}/api/forecast/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tank, readings })
    })
  } catch (err) {
    return res.status(503).json({
      status: 'fail',
      message: 'Forecast service is unavailable.',
      error: err.message
    })
  }

  let fc
  try {
    fc = await fres.json()
  } catch (err) {
    return res.status(502).json({
      status: 'fail',
      message: 'Forecast service returned an invalid response.'
    })
  }

  if (!fres.ok) {
    return res.status(fres.status).json({
      status: 'fail',
      message: fc.error || fc.message || 'Unable to calculate the tank forecast.'
    })
  }

  // Days from estimated_readings (see withEstimates): estimates, not measurements
  const estimated = new Set(rows.filter((row) => row.is_synthetic).map((row) => row.date))
  fc.estimated_dates = [...estimated]
  fc.history = fc.history.map((h) => (estimated.has(h.date) ? { ...h, estimated: true } : h))

  return res.status(200).json({
    status: 'success',
    ...idField,
    data: extend(fc)
  })
}

// Estimates from Tank-Reserviour/add-synthetic-readings.py, merged in only for days without a real
// reading. kind is 'reservoir' or 'mahaweli'. extra(e) adds the fields that kind's rows have.
async function withEstimates(rows, kind, id, extra = () => ({})) {
  let est
  try {
    est = await db.query(
      `SELECT to_char(reading_date, 'YYYY-MM-DD') AS date, storage_acft
       FROM estimated_readings
       WHERE kind = $1 AND ref_id = $2 AND reading_date >= CURRENT_DATE - INTERVAL '90 days'`,
      [kind, id]
    )
  } catch (err) {
    if (err.code === '42P01') return rows // no estimated_readings table: no estimates were added
    throw err
  }
  const real = new Set(rows.map((row) => row.date))
  const added = est.rows
    .filter((e) => !real.has(e.date))
    .map((e) => ({ ...e, ...extra(e), is_synthetic: true }))
  return [...rows, ...added].sort((a, b) => a.date.localeCompare(b.date))
}

exports.getForecastByTankId = async (req, res, next) => {
  const { id } = req.params
  // security: id must be a plain positive int before it goes near the db
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Tank ID must be a positive integer.'
    })
  }

  try {
    // A tank linked to its reservoir (models/add-mahawelitanks-reservoir.sql) is forecast from
    // the reservoir's daily readings, which go back much further than the Mahaweli ones
    const link = await db.query('SELECT reservoir_id FROM mahawelitanks WHERE id = $1', [id])
    const reservoirId = link.rows[0]?.reservoir_id
    if (reservoirId != null) {
      const withTank = {
        status(code) { res.status(code); return withTank },
        json(body) { return res.json({ tank_id: Number(id), ...body }) }
      }
      return exports.getForecastByReservoirId({ params: { id: String(reservoirId) } }, withTank, next)
    }

    const r = await db.query(
      `SELECT t.id, t.tank_name,
              to_char(l.reading_date, 'YYYY-MM-DD') AS date,
              l.storage_mcm * $2 AS storage_acft
       FROM mahawelitanks t
       JOIN mahaweli_water_level l ON l.tank_id = t.id
       WHERE t.id = $1
         AND l.reading_date >= CURRENT_DATE - INTERVAL '90 days'
         AND l.storage_mcm IS NOT NULL
       ORDER BY l.reading_date ASC`,
      [id, ACFT_PER_MCM]
    )

    const rows = await withEstimates(r.rows, 'mahaweli', id)
    const tank = r.rows.length > 0
      ? r.rows[0]
      : (await db.query('SELECT id, tank_name FROM mahawelitanks WHERE id = $1', [id])).rows[0]
    if (!tank) {
      return res.status(404).json({
        status: 'fail',
        message: `Tank with ID ${id} not found.`
      })
    }
    if (rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: `Tank with ID ${id} has no stored water-level readings from the last 90 days.`
      })
    }

    return sendForecast(res, tank.tank_name, rows, { tank_id: Number(id) })
  } catch (err) {
    next(err)
  }
}

exports.getForecastByReservoirId = async (req, res, next) => {
  const { id } = req.params
  // security: same int check as above
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Reservoir ID must be a positive integer.'
    })
  }

  try {
    const resv = await db.query('SELECT id, name, active_capacity_acft FROM reservoirs WHERE id = $1', [id])
    if (resv.rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: `Reservoir with ID ${id} not found.`
      })
    }

    // The model was trained on effective storage (the source's "Effective Storage_Acft",
    // stored here as usable_storage_acft), so its fill_ref is an effective-storage level
    const r = await db.query(
      `SELECT to_char(reading_date, 'YYYY-MM-DD') AS date, usable_storage_acft AS storage_acft,
              usable_storage_acft, usable_storage_percent, rainfall_prev_day_mm
       FROM reservoir_levels
       WHERE reservoir_id = $1
         AND reading_date >= CURRENT_DATE - INTERVAL '90 days'
         AND usable_storage_acft IS NOT NULL
       ORDER BY reading_date ASC`,
      [id]
    )
    const rows = await withEstimates(r.rows, 'reservoir', id, (e) => ({
      usable_storage_acft: e.storage_acft, usable_storage_percent: null, rainfall_prev_day_mm: null
    }))
    if (rows.length === 0) {
      return res.status(404).json({
        status: 'fail',
        message: `${resv.rows[0].name} has no stored water-level readings from the last 90 days.`
      })
    }

    // portal shows usable % of active capacity (like the irrigation dept); the model's fill is a share
    // of its own fill_ref, so move the latest real usable storage by the model's predicted change
    const cap = Number(resv.rows[0].active_capacity_acft)
    const last = rows[rows.length - 1]
    const pct = (acft) => Math.round(Math.max(0, acft) / cap * 1000) / 10
    const withUsable = (fc) => {
      const usableNow = Number(last.usable_storage_acft)
      const usableNext = Math.max(0, usableNow + (fc.predicted_fill_in_14d - fc.fill_now) * fc.fill_ref_acft)
      return {
        ...fc,
        usable_capacity_acft: cap,
        usable_now_pct: last.usable_storage_percent == null ? pct(usableNow) : Number(last.usable_storage_percent),
        usable_storage_now_acft: usableNow,
        usable_predicted_pct: pct(usableNext),
        usable_storage_predicted_acft: Math.round(usableNext),
        // real readings only, no gap filling or estimates, for the chart. Rows from the season CSVs
        // (import-season-history.py) have storage but no percent, so it is worked out like usable_now_pct
        readings: r.rows
          .map((row) => ({
            date: row.date,
            usable_pct: row.usable_storage_percent == null ? pct(Number(row.usable_storage_acft)) : Number(row.usable_storage_percent),
            rain_mm: row.rainfall_prev_day_mm == null ? null : Number(row.rainfall_prev_day_mm)
          }))
      }
    }

    return sendForecast(res, resv.rows[0].name, rows, { reservoir_id: Number(id) }, cap > 0 && last.usable_storage_acft != null ? withUsable : undefined)
  } catch (err) {
    next(err)
  }
}
