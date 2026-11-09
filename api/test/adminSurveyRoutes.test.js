const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const db = require('../config/db.js')
const surveyRouter = require('../routes/ADMIN/surveyroutes.js')

test('survey read routes forward database errors to the API error handler', async () => {
  const originalQuery = db.query
  const expectedError = new Error('relation "surveys" does not exist')
  db.query = async () => { throw expectedError }

  const app = express()
  app.use('/', surveyRouter)
  app.use((err, req, res, next) => {
    res.status(500).json({ message: err.message })
  })

  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer))
  })

  try {
    const { port } = server.address()
    for (const path of ['/', '/1']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      assert.equal(response.status, 500)
      assert.deepEqual(await response.json(), { message: expectedError.message })
    }
  } finally {
    db.query = originalQuery
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
})
