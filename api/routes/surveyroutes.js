// Farmer-facing disaster surveys (/api/surveys)
const express = require('express')
const requireFarmer = require('../middleware/requireFarmer.js')
const {
  getActiveSurveysForFarmer,
  submitSurveyResponse
} = require('../services/surveyService.js')

const surveyRouter = express.Router()

// GET /api/surveys and /api/surveys/active
const handleGetActive = async (req, res, next) => {
  try {
    const list = await getActiveSurveysForFarmer(req.farmerId)
    res.status(200).json({ status: 'success', data: list })
  } catch (err) {
    next(err)
  }
}

surveyRouter.get('/', requireFarmer, handleGetActive)
surveyRouter.get('/active', requireFarmer, handleGetActive)

// POST /api/surveys/:id/respond
surveyRouter.post('/:id/respond', requireFarmer, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ status: 'fail', message: 'Invalid survey ID.' })
    }
    const result = await submitSurveyResponse(req.farmerId, id, req.body?.answers || req.body)
    res.status(201).json({ status: 'success', data: result })
  } catch (err) {
    if (err.message && !err.code) {
      return res.status(400).json({ status: 'fail', message: err.message })
    }
    next(err)
  }
})

module.exports = surveyRouter
