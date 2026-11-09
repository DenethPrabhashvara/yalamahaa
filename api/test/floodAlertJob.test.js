const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../config/db.js')
const campaignService = require('../services/campaignService.js')
const originalQuery = db.query
const originalSendCampaign = campaignService.sendCampaign

const failedPhone = '94771234568'
const alreadySentPhone = '94771234567'
const queries = []
let campaignFarmers = []

db.query = async (text, params = []) => {
  queries.push({ text, params })
  if (text.includes('FROM river_level_realtime')) {
    return {
      rows: [{
        basin: 'Test River',
        station: 'Test Gauge',
        latitude: 7,
        longitude: 81,
        alertpull: 1,
        minorpull: 2,
        majorpull: 3,
        levels: ['1.5', '1.4'],
        latest_at: new Date()
      }]
    }
  }
  if (text.includes('FROM farmers f')) {
    return {
      rows: [
        { full_name: 'Already Sent', phone: alreadySentPhone, water_source: 'river', water_name: 'Test River', flood_category: 'medium' },
        { full_name: 'Needs Retry', phone: failedPhone, water_source: 'river', water_name: 'Test River', flood_category: 'medium' }
      ]
    }
  }
  if (text.includes('SELECT DISTINCT m.phone')) {
    return { rows: [{ phone: alreadySentPhone }] }
  }
  if (text.includes('INSERT INTO gauge_alert_state')) return { rowCount: 1, rows: [{ basin: 'Test River' }] }
  return { rowCount: 1, rows: [] }
}

campaignService.sendCampaign = async ({ farmers }) => {
  campaignFarmers = farmers
  return { id: 1, recipients: farmers.length, delivered: 0, failed: farmers.length, dry_run: false }
}

delete require.cache[require.resolve('../services/floodAlertJob.js')]
const { checkGauges } = require('../services/floodAlertJob.js')

test.after(() => {
  db.query = originalQuery
  campaignService.sendCampaign = originalSendCampaign
  delete require.cache[require.resolve('../services/floodAlertJob.js')]
  db.pool?.end().catch(() => {})
})

test('flood alert retries failed recipients without resending to farmers already sent', async () => {
  const result = await checkGauges({ manual: true })

  assert.equal(result.length, 1)
  assert.deepEqual(campaignFarmers.map((farmer) => farmer.phone), [failedPhone])
  assert.ok(queries.some(({ text }) => text.includes("m.status <> 'Failed'")))
  assert.ok(queries.some(({ text }) => text.includes('SET alert_sent_at = NULL')))
})
