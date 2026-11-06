const db = require('../config/db.js')
const { checkBoundary, nearPin, MAX_KM_FROM_PIN } = require('./fieldShape.js')

const WATER_SOURCES = ['tank', 'canal', 'river', 'well', 'rain']
const YIELD_UNITS = ['kg', 'bu', 't']
const MAX_CROPS = 20
const FLOOD_HISTORY = ['never', 'once', 'several', 'unsure']   // in the last 5 years
const FLOOD_DEPTHS = ['ankle', 'knee', 'waist']                // deepest the water got; waist = waist or higher
const FLOOD_FIRST_YEAR = 1950

// runs fn(client) in a transaction, rolls back if it throws
async function withTransaction(fn) {
    const client = await db.pool.connect()
    try {
        await client.query('BEGIN')
        const res = await fn(client)
        await client.query('COMMIT')
        return res
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
    } finally {
        client.release()
    }
}

const text = (val, max = 120) => (typeof val === 'string' && val.trim() ? val.trim().slice(0, max) : null)

// Field size, boundary and flood history. Each one is only changed when its key is sent,
// so older app versions and partial admin edits never wipe them. null clears a value.
// returns { error } or { extra } with only the keys that were sent
function validateFieldDetails(body) {
    const extra = {}

    if (body.total_acres !== undefined) {
        if (body.total_acres === null || body.total_acres === '') {
            extra.total_acres = null
        } else {
            const n = Number(body.total_acres)
            if (!Number.isFinite(n) || n <= 0 || n > 100000) return { error: 'total_acres must be a number above 0.' }
            extra.total_acres = Math.round(n * 100) / 100
        }
    }

    if (body.boundary !== undefined) {
        if (body.boundary === null) {
            extra.boundary = null
        } else {
            const chk = checkBoundary(body.boundary)
            if (chk.error) return { error: chk.error }
            extra.boundary = chk
        }
    }

    if (body.flood_history !== undefined) {
        const history = body.flood_history
        if (history !== null && !FLOOD_HISTORY.includes(history)) {
            return { error: `flood_history must be one of: ${FLOOD_HISTORY.join(', ')}.` }
        }
        // depth and year only mean something if the field did flood
        const flooded = history === 'once' || history === 'several'
        let depth = null
        let year = null
        if (flooded && body.flood_depth != null) {
            if (!FLOOD_DEPTHS.includes(body.flood_depth)) return { error: `flood_depth must be one of: ${FLOOD_DEPTHS.join(', ')}.` }
            depth = body.flood_depth
        }
        if (flooded && body.flood_last_year != null) {
            year = Number(body.flood_last_year)
            if (!Number.isInteger(year) || year < FLOOD_FIRST_YEAR || year > new Date().getFullYear()) {
                return { error: 'flood_last_year must be a past year.' }
            }
        }
        extra.flood = { history, depth, last_year: year }
    } else if (body.flood_depth !== undefined || body.flood_last_year !== undefined) {
        return { error: 'Send flood_history with flood_depth and flood_last_year.' }
    }

    return { extra }
}

// returns { error } or { farm }. crops stays undefined if it wasn't sent
//whitelists water source / yield unit, caps crop count, number ranges and text length
function validateFarm(body, { requireCrops = false } = {}) {
    const { water_source, water_name, location_label, crops } = body || {}

    if (water_source != null && !WATER_SOURCES.includes(water_source)) {
        return { error: `water_source must be one of: ${WATER_SOURCES.join(', ')}.` }
    }
    const field = validateFieldDetails(body || {})
    if (field.error) return { error: field.error }
    if (crops === undefined && !requireCrops) {
        return { farm: { water_source: water_source ?? null, water_name: text(water_name), location_label: text(location_label), ...field.extra } }
    }
    if (!Array.isArray(crops) || crops.length === 0) {
        return { error: 'Add at least one crop.' }
    }
    if (crops.length > MAX_CROPS) {
        return { error: `A farm can have at most ${MAX_CROPS} crops.` }
    }

    const cleaned = []
    for (const [i, crop] of crops.entries()) {
        const n = i + 1
        const type = text(crop?.crop_type, 80)
        if (!type) return { error: `Crop ${n}: crop_type is required.` }
        const acres = Number(crop.acres)
        if (!Number.isFinite(acres) || acres <= 0 || acres > 100000) {
            return { error: `Crop ${n}: acres must be a number above 0.` }
        }
        const lastYld = crop.last_yield == null || crop.last_yield === '' ? null : Number(crop.last_yield)
        if (lastYld !== null && (!Number.isFinite(lastYld) || lastYld < 0)) {
            return { error: `Crop ${n}: last_yield must be a number of 0 or more.` }
        }
        if (crop.yield_unit != null && !YIELD_UNITS.includes(crop.yield_unit)) {
            return { error: `Crop ${n}: yield_unit must be one of: ${YIELD_UNITS.join(', ')}.` }
        }
        cleaned.push({
            category: text(crop.category, 40),
            crop_type: type,
            variety: text(crop.variety, 80),
            acres: Math.round(acres * 100) / 100,
            last_yield: lastYld,
            yield_unit: crop.yield_unit ?? null
        })
    }

    return {
        farm: { water_source: water_source ?? null, water_name: text(water_name), location_label: text(location_label), crops: cleaned, ...field.extra }
    }
}

// totals also kept on the farmers row so the old queries still work
function cropSummary(crops) {
    return {
        land_acres: Math.round(crops.reduce((sum, c) => sum + c.acres, 0) * 100) / 100,
        primary_crop: crops[0].crop_type
    }
}

// thrown when the farm details are fine on their own but not with the farmer's saved pin
function badFarm(message) {
    const e = new Error(message)
    e.status = 400
    return e
}

// insert/replace farm details. if farm.crops is there the whole crop list gets replaced.
// total_acres, boundary and flood are only written when validateFarm saw them (see validateFieldDetails)
async function saveFarm(client, farmId, farm) {
    const hasTotal = farm.total_acres !== undefined
    const hasBoundary = farm.boundary !== undefined
    const hasFlood = farm.flood !== undefined

    if (hasBoundary && farm.boundary) {
        // runs after the pin is saved (register inserts the farmer first, the portal saves the profile first)
        const pin = await client.query('SELECT farm_latitude AS lat, farm_longitude AS lng FROM farmers WHERE farm_id = $1', [farmId])
        if (!nearPin(farm.boundary.boundary, pin.rows[0])) {
            throw badFarm(`The field boundary must be within ${MAX_KM_FROM_PIN} km of the farm pin.`)
        }
    }

    const flood = farm.flood || {}
    await client.query(
        `INSERT INTO farms (farm_id, water_source, water_name, location_label,
                            total_acres, boundary, boundary_acres, flood_history, flood_depth, flood_last_year)
         VALUES ($1, $2, $3, $4, $6, $8, $9, $11, $12, $13)
         ON CONFLICT (farm_id) DO UPDATE SET
             water_source    = EXCLUDED.water_source,
             water_name      = EXCLUDED.water_name,
             location_label  = EXCLUDED.location_label,
             total_acres     = CASE WHEN $5  THEN EXCLUDED.total_acres     ELSE farms.total_acres     END,
             boundary        = CASE WHEN $7  THEN EXCLUDED.boundary        ELSE farms.boundary        END,
             boundary_acres  = CASE WHEN $7  THEN EXCLUDED.boundary_acres  ELSE farms.boundary_acres  END,
             flood_history   = CASE WHEN $10 THEN EXCLUDED.flood_history   ELSE farms.flood_history   END,
             flood_depth     = CASE WHEN $10 THEN EXCLUDED.flood_depth     ELSE farms.flood_depth     END,
             flood_last_year = CASE WHEN $10 THEN EXCLUDED.flood_last_year ELSE farms.flood_last_year END`,
        [
            farmId, farm.water_source, farm.water_name, farm.location_label,
            hasTotal, hasTotal ? farm.total_acres : null,
            hasBoundary, farm.boundary ? JSON.stringify(farm.boundary.boundary) : null, farm.boundary ? farm.boundary.acres : null,
            hasFlood, flood.history ?? null, flood.depth ?? null, flood.last_year ?? null
        ]
    )
    if (!farm.crops) return

    await client.query('DELETE FROM farm_crops WHERE farm_id = $1', [farmId])
    for (const [pos, crop] of farm.crops.entries()) {
        await client.query(
            `INSERT INTO farm_crops (farm_id, position, category, crop_type, variety, acres, last_yield, yield_unit)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [farmId, pos, crop.category, crop.crop_type, crop.variety, crop.acres, crop.last_yield, crop.yield_unit]
        )
    }
    const { land_acres, primary_crop } = cropSummary(farm.crops)
    await client.query('UPDATE farmers SET land_acres = $2, primary_crop = $3 WHERE farm_id = $1', [farmId, land_acres, primary_crop])
}

// null if nothing saved yet
async function getFarm(farmId, client = db) {
    const farm = await client.query(
        `SELECT farm_id, water_source, water_name, location_label,
                total_acres, boundary, boundary_acres, flood_history, flood_depth, flood_last_year,
                created_at, updated_at
         FROM farms WHERE farm_id = $1`,
        [farmId]
    )
    if (!farm.rows[0]) return null
    const crops = await client.query(
        `SELECT category, crop_type, variety, acres, last_yield, yield_unit
         FROM farm_crops WHERE farm_id = $1 ORDER BY position`,
        [farmId]
    )
    return { ...farm.rows[0], crops: crops.rows }
}

module.exports = { withTransaction, validateFarm, cropSummary, saveFarm, getFarm, FLOOD_HISTORY, FLOOD_DEPTHS }
