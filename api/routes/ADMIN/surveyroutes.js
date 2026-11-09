const express = require('express')
const {
  listSurveys,
  createSurvey,
  getSurveyDetails,
  setSurveyStatus,
  deleteSurvey
} = require('../../services/surveyService.js')
const { sendDbError } = require('./dbErrors.js')

const surveyAdminRouter = express.Router()

// GET /admin/surveys
surveyAdminRouter.get('/', async (req, res, next) => {
  try {
    const list = await listSurveys()
    res.status(200).json({ status: 'success', data: list })
  } catch (err) {
    return sendDbError(res, next, err)
  }
})

// POST /admin/surveys
surveyAdminRouter.post('/', async (req, res, next) => {
  try {
    const created = await createSurvey(req.admin?.admin_id, req.body)
    res.status(201).json({ status: 'success', data: created })
  } catch (err) {
    if (err.message && !err.code) {
      return res.status(400).json({ status: 'fail', message: err.message })
    }
    return sendDbError(res, next, err)
  }
})

// GET /admin/surveys/:id
surveyAdminRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Invalid survey ID.' })
    }
    const details = await getSurveyDetails(id)
    if (!details) {
      return res.status(404).json({ status: 'fail', message: 'Survey not found.' })
    }
    res.status(200).json({ status: 'success', data: details })
  } catch (err) {
    return sendDbError(res, next, err)
  }
})

// PATCH /admin/surveys/:id
surveyAdminRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Invalid survey ID.' })
    }
    const { status } = req.body || {}
    const updated = await setSurveyStatus(id, status)
    if (!updated) {
      return res.status(404).json({ status: 'fail', message: 'Survey not found.' })
    }
    res.status(200).json({ status: 'success', data: updated })
  } catch (err) {
    if (err.message && !err.code) {
      return res.status(400).json({ status: 'fail', message: err.message })
    }
    return sendDbError(res, next, err)
  }
})

// DELETE /admin/surveys/:id
surveyAdminRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Invalid survey ID.' })
    }
    const deleted = await deleteSurvey(id)
    if (!deleted) {
      return res.status(404).json({ status: 'fail', message: 'Survey not found.' })
    }
    res.status(200).json({ status: 'success', message: 'Survey deleted successfully.' })
  } catch (err) {
    return sendDbError(res, next, err)
  }
})

module.exports = surveyAdminRouter
