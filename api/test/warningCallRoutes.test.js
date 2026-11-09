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
      assert.equal(body.data.twilio_configured, false)
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
