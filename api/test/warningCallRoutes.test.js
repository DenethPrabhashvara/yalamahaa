const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const db = require('../config/db.js')
const smsRouter = require('../routes/ADMIN/alertroutes.js')

async function withServer(run) {
  const app = express()
  app.use(express.json())
  app.use('/', smsRouter)
  app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message })
  })

  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer))
  })

  try {
    await run(`http://127.0.0.1:${server.address().port}`)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

test('warning-call status route returns settings and history', async () => {
  const originalQuery = db.query
  db.query = async (sql) => {
    if (/FROM storm_calls/.test(sql)) return { rows: [] }
    assert.match(sql, /app_settings/)
    return { rows: [] }
  }

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/storm-calls`)
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.data.enabled, false)
      assert.equal(typeof body.data.twilio_configured, 'boolean')
      assert.deepEqual(body.data.calls, [])
    })
  } finally {
    db.query = originalQuery
  }
})

test('warning-call test route validates the phone number', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/storm-calls/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'not-a-phone' }),
    })
    assert.equal(response.status, 400)
    assert.equal((await response.json()).message, 'Enter a phone number like 0771234567.')
  })
})

test('flood alert demo-preview route returns risk-adapted advisory message', async () => {
  const originalQuery = db.query
  db.query = async (sql) => {
    if (/river_level_realtime/.test(sql)) {
      return { rows: [{ alertpull: 3.5, minorpull: 4.5, majorpull: 6.0, water_level: 3.8 }] }
    }
    return { rows: [] }
  }

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auto-alerts/demo-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basin: 'Kelani Ganga',
          station: 'Kithulgala',
          floodStage: 'alert',
          riskCategory: 'higher_susceptibility',
        }),
      })
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.status, 'success')
      assert.match(body.data.message, /more flood-prone/)
      assert.equal(body.data.riskCategory, 'higher_susceptibility')
    })
  } finally {
    db.query = originalQuery
  }
})

test('flood alert demo-send route validates recipient phone number', async () => {
  const originalQuery = db.query
  db.query = async (sql) => {
    if (/river_level_realtime/.test(sql)) {
      return { rows: [{ alertpull: 3.5, minorpull: 4.5, majorpull: 6.0, water_level: 3.8 }] }
    }
    return { rows: [] }
  }

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/auto-alerts/demo-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basin: 'Kelani Ganga',
          station: 'Kithulgala',
          phone: 'invalid-number',
        }),
      })
      assert.equal(response.status, 400)
      const body = await response.json()
      assert.equal(body.status, 'fail')
      assert.match(body.message, /Invalid mobile number/)
    })
  } finally {
    db.query = originalQuery
  }
})
