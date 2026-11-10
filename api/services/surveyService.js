// Surveys & disaster assessments service
const db = require('../config/db.js')

const CATEGORIES = ['disaster', 'flood', 'drought', 'pest', 'general']
const TARGET_TYPES = ['all', 'district', 'reservoir', 'tank', 'farmers']
const QUESTION_TYPES = ['choice', 'multi_choice', 'yes_no', 'number', 'text']
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SPECIFIC_FARMER_MATCH = `s.target_type = 'farmers'
  AND jsonb_typeof(s.target_value) = 'array'
  AND s.target_value @> jsonb_build_array(f.farmer_id::text)`

function cleanString(val, maxLen) {
  if (typeof val !== 'string') return ''
  return val.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLen)
}

function cleanTranslations(raw, { options = null, kind }) {
  if (raw == null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Translations must be an object keyed by language.')
  }

  const translations = {}
  for (const language of ['si', 'ta']) {
    const source = raw[language]
    if (source == null) continue
    if (typeof source !== 'object' || Array.isArray(source)) {
      throw new Error(`The ${language} translation must be an object.`)
    }

    const translated = {}
    if (kind === 'survey') {
      const title = cleanString(source.title, 150)
      const description = cleanString(source.description, 1000)
      if (title) translated.title = title
      if (description) translated.description = description
    } else {
      const questionText = cleanString(source.question_text, 300)
      if (questionText) translated.question_text = questionText

      if (source.options != null) {
        if (!Array.isArray(source.options) || !Array.isArray(options) || source.options.length !== options.length) {
          throw new Error(`The ${language} option translations must match the English options.`)
        }
        const translatedOptions = source.options.map((option) => cleanString(option, 120))
        if (translatedOptions.some((option) => !option)) {
          throw new Error(`The ${language} option translations cannot be empty.`)
        }
        translated.options = translatedOptions
      }
    }

    if (Object.keys(translated).length > 0) translations[language] = translated
  }

  return Object.keys(translations).length > 0 ? translations : null
}

function validateSurveyPayload(payload) {
  const title = cleanString(payload?.title, 150)
  if (!title || title.length < 3) {
    throw new Error('Survey title is required (at least 3 characters).')
  }

  const description = cleanString(payload?.description, 1000)
  const category = CATEGORIES.includes(payload?.category) ? payload.category : 'disaster'

  const target = payload?.target || {}
  const targetType = target.type
  if (!TARGET_TYPES.includes(targetType)) {
    throw new Error(`Invalid target type: ${targetType}`)
  }

  let targetValue = null
  let targetLabel = cleanString(target.label, 120)

  if (targetType === 'all') {
    targetValue = null
    targetLabel = targetLabel || 'All Active Farmers'
  } else if (targetType === 'district') {
    if (!target.value || typeof target.value !== 'string') {
      throw new Error('A district must be specified for district-targeted surveys.')
    }
    targetValue = cleanString(target.value, 60)
    targetLabel = targetLabel || `District: ${targetValue}`
  } else if (targetType === 'reservoir' || targetType === 'tank') {
    const id = Number(target.value)
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`A valid ${targetType} ID must be specified.`)
    }
    targetValue = id
    targetLabel = targetLabel || `${targetType === 'reservoir' ? 'Reservoir' : 'Tank'} #${id}`
  } else if (targetType === 'farmers') {
    if (!Array.isArray(target.value) || target.value.length === 0) {
      throw new Error('At least one farmer must be selected.')
    }
    const invalid = target.value.some((id) => !UUID_REGEX.test(id))
    if (invalid) {
      throw new Error('Invalid farmer ID in selection.')
    }
    targetValue = [...new Set(target.value)]
    targetLabel = targetLabel || `${targetValue.length} Selected Farmer${targetValue.length === 1 ? '' : 's'}`
  }

  const rawQuestions = Array.isArray(payload?.questions) ? payload.questions : []
  if (rawQuestions.length === 0) {
    throw new Error('Survey must contain at least one question.')
  }
  if (rawQuestions.length > 25) {
    throw new Error('Survey cannot have more than 25 questions.')
  }

  const questions = rawQuestions.map((q, idx) => {
    const text = cleanString(q.question_text || q.text, 300)
    if (!text || text.length < 2) {
      throw new Error(`Question #${idx + 1} text is required.`)
    }
    const type = q.question_type || q.type
    if (!QUESTION_TYPES.includes(type)) {
      throw new Error(`Question #${idx + 1} has invalid type: ${type}`)
    }

    let options = null
    if (type === 'choice' || type === 'multi_choice') {
      const opts = Array.isArray(q.options) ? q.options.map((o) => cleanString(o, 120)).filter(Boolean) : []
      if (opts.length < 2) {
        throw new Error(`Question #${idx + 1} (${type}) requires at least 2 options.`)
      }
      if (opts.length > 10) {
        throw new Error(`Question #${idx + 1} cannot have more than 10 options.`)
      }
      options = opts
    }

    return {
      position: idx,
      question_text: text,
      question_type: type,
      options,
      translations: cleanTranslations(q.translations, { options, kind: 'question' }),
      required: q.required !== false
    }
  })

  return {
    title,
    description,
    translations: cleanTranslations(payload?.translations, { kind: 'survey' }),
    category,
    target_type: targetType,
    target_value: targetValue,
    target_label: targetLabel,
    questions
  }
}

function isSurveyTargetedToFarmer(survey, farmerId, farmer) {
  switch (survey.target_type) {
    case 'all':
      return true
    case 'district':
      return String(survey.target_value ?? '').trim().toLowerCase() === String(farmer.district ?? '').trim().toLowerCase()
    case 'reservoir':
      return survey.target_value != null && farmer.reservoir_id != null &&
        Number(survey.target_value) === Number(farmer.reservoir_id)
    case 'tank':
      return survey.target_value != null && farmer.tank_id != null &&
        Number(survey.target_value) === Number(farmer.tank_id)
    case 'farmers':
      return Array.isArray(survey.target_value) &&
        survey.target_value.some((targetId) => String(targetId).toLowerCase() === String(farmerId).toLowerCase())
    default:
      return false
  }
}

async function createSurvey(adminId, payload) {
  const data = validateSurveyPayload(payload)
  const client = await db.getClient ? await db.getClient() : db
  const isPoolClient = typeof client.release === 'function'

  try {
    if (isPoolClient) await client.query('BEGIN')

    const sRes = await client.query(
      `INSERT INTO surveys (title, description, translations, category, target_type, target_value, target_label, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
       RETURNING id, title, description, translations, category, target_type, target_value, target_label, status, created_at`,
      [
        data.title,
        data.description || null,
        data.translations ? JSON.stringify(data.translations) : '{}',
        data.category,
        data.target_type,
        data.target_value ? JSON.stringify(data.target_value) : null,
        data.target_label,
        adminId || null
      ]
    )
    const survey = sRes.rows[0]

    const insertedQuestions = []
    for (const q of data.questions) {
      const qRes = await client.query(
        `INSERT INTO survey_questions (survey_id, position, question_text, question_type, options, translations, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, survey_id, position, question_text, question_type, options, translations, required`,
        [
          survey.id,
          q.position,
          q.question_text,
          q.question_type,
          q.options ? JSON.stringify(q.options) : null,
          q.translations ? JSON.stringify(q.translations) : '{}',
          q.required
        ]
      )
      insertedQuestions.push(qRes.rows[0])
    }

    if (isPoolClient) await client.query('COMMIT')
    return { ...survey, questions: insertedQuestions }
  } catch (err) {
    if (isPoolClient) await client.query('ROLLBACK')
    throw err
  } finally {
    if (isPoolClient) client.release()
  }
}

async function listSurveys() {
  const sql = `
    SELECT s.id, s.title, s.description, s.translations, s.category, s.target_type, s.target_value, s.target_label, s.status,
           s.created_at, s.updated_at,
           a.full_name AS created_by_name,
           (SELECT count(*)::int FROM survey_questions sq WHERE sq.survey_id = s.id) AS question_count,
           (SELECT count(*)::int FROM survey_responses sr WHERE sr.survey_id = s.id) AS response_count,
           (
             SELECT count(*)::int FROM farmers f
             WHERE f.is_active AND (
               s.target_type = 'all'
               OR (s.target_type = 'district' AND lower(COALESCE(s.target_value #>> '{}', '')) = lower(f.district))
               OR (s.target_type = 'reservoir' AND (CASE WHEN s.target_type = 'reservoir' THEN (s.target_value #>> '{}')::int END) = f.reservoir_id)
               OR (s.target_type = 'tank' AND (CASE WHEN s.target_type = 'tank' THEN (s.target_value #>> '{}')::int END) = f.tank_id)
               OR (${SPECIFIC_FARMER_MATCH})
             )
           ) AS recipient_count
    FROM surveys s
    LEFT JOIN admins a ON a.admin_id = s.created_by
    ORDER BY s.created_at DESC
  `
  const res = await db.query(sql)
  return res.rows
}

async function getSurveyDetails(surveyId) {
  const sRes = await db.query(
    `SELECT s.id, s.title, s.description, s.translations, s.category, s.target_type, s.target_value, s.target_label, s.status,
            s.created_at, s.updated_at,
            a.full_name AS created_by_name
     FROM surveys s
     LEFT JOIN admins a ON a.admin_id = s.created_by
     WHERE s.id = $1`,
    [surveyId]
  )
  if (sRes.rows.length === 0) return null
  const survey = sRes.rows[0]

  const qRes = await db.query(
    `SELECT id, survey_id, position, question_text, question_type, options, translations, required
     FROM survey_questions
     WHERE survey_id = $1
     ORDER BY position ASC`,
    [surveyId]
  )
  const questions = qRes.rows

  // Get recipient count
  const countRes = await db.query(
    `SELECT count(*)::int AS n FROM farmers f
     CROSS JOIN surveys s
     WHERE s.id = $1 AND f.is_active AND (
       s.target_type = 'all'
       OR (s.target_type = 'district' AND lower(COALESCE(s.target_value #>> '{}', '')) = lower(f.district))
       OR (s.target_type = 'reservoir' AND (CASE WHEN s.target_type = 'reservoir' THEN (s.target_value #>> '{}')::int END) = f.reservoir_id)
       OR (s.target_type = 'tank' AND (CASE WHEN s.target_type = 'tank' THEN (s.target_value #>> '{}')::int END) = f.tank_id)
       OR (${SPECIFIC_FARMER_MATCH})
     )`,
    [surveyId]
  )
  const recipientCount = countRes.rows[0]?.n || 0

  // Get responses with farmer info
  const rRes = await db.query(
    `SELECT sr.id, sr.survey_id, sr.farmer_id, sr.farm_id, sr.answers, sr.submitted_at,
            f.full_name, f.phone, f.district, f.division
     FROM survey_responses sr
     JOIN farmers f ON f.farmer_id = sr.farmer_id
     WHERE sr.survey_id = $1
     ORDER BY sr.submitted_at DESC`,
    [surveyId]
  )
  const responses = rRes.rows

  // Compute summary aggregation for each question
  const summary = {}
  for (const q of questions) {
    const qid = String(q.id)
    if (q.question_type === 'choice' || q.question_type === 'yes_no') {
      const tallies = {}
      if (q.question_type === 'yes_no') {
        tallies['Yes'] = 0
        tallies['No'] = 0
      } else if (Array.isArray(q.options)) {
        for (const opt of q.options) tallies[opt] = 0
      }
      for (const r of responses) {
        const val = r.answers?.[qid]
        if (val !== undefined && val !== null) {
          const str = String(val)
          tallies[str] = (tallies[str] || 0) + 1
        }
      }
      summary[qid] = { type: q.question_type, tallies }
    } else if (q.question_type === 'multi_choice') {
      const tallies = {}
      if (Array.isArray(q.options)) {
        for (const opt of q.options) tallies[opt] = 0
      }
      for (const r of responses) {
        const val = r.answers?.[qid]
        if (Array.isArray(val)) {
          for (const item of val) {
            tallies[item] = (tallies[item] || 0) + 1
          }
        }
      }
      summary[qid] = { type: q.question_type, tallies }
    } else if (q.question_type === 'number') {
      const numbers = []
      for (const r of responses) {
        const val = r.answers?.[qid]
        if (val !== undefined && val !== null && !isNaN(Number(val))) {
          numbers.push(Number(val))
        }
      }
      const sum = numbers.reduce((a, b) => a + b, 0)
      const avg = numbers.length > 0 ? Math.round((sum / numbers.length) * 10) / 10 : 0
      const min = numbers.length > 0 ? Math.min(...numbers) : 0
      const max = numbers.length > 0 ? Math.max(...numbers) : 0
      summary[qid] = { type: 'number', count: numbers.length, avg, min, max }
    } else {
      summary[qid] = { type: 'text', count: responses.filter((r) => Boolean(r.answers?.[qid])).length }
    }
  }

  return {
    ...survey,
    recipient_count: recipientCount,
    response_count: responses.length,
    questions,
    summary,
    responses
  }
}

async function setSurveyStatus(surveyId, status) {
  if (status !== 'active' && status !== 'closed') {
    throw new Error('Status must be active or closed.')
  }
  const res = await db.query(
    'UPDATE surveys SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
    [surveyId, status]
  )
  return res.rows[0] || null
}

async function deleteSurvey(surveyId) {
  const res = await db.query('DELETE FROM surveys WHERE id = $1 RETURNING id', [surveyId])
  return res.rowCount > 0
}

// Farmer Portal queries
async function getActiveSurveysForFarmer(farmerId) {
  const sql = `
    SELECT s.id, s.title, s.description, s.translations, s.category, s.target_label, s.created_at
    FROM surveys s
    CROSS JOIN farmers f
    LEFT JOIN survey_responses sr ON sr.survey_id = s.id AND sr.farmer_id = f.farmer_id
    WHERE f.farmer_id = $1 AND f.is_active AND s.status = 'active'
      AND sr.id IS NULL
      AND (
        s.target_type = 'all'
        OR (s.target_type = 'district' AND lower(COALESCE(s.target_value #>> '{}', '')) = lower(f.district))
        OR (s.target_type = 'reservoir' AND (CASE WHEN s.target_type = 'reservoir' THEN (s.target_value #>> '{}')::int END) = f.reservoir_id)
        OR (s.target_type = 'tank' AND (CASE WHEN s.target_type = 'tank' THEN (s.target_value #>> '{}')::int END) = f.tank_id)
        OR (${SPECIFIC_FARMER_MATCH})
      )
    ORDER BY s.created_at DESC
  `
  const sRes = await db.query(sql, [farmerId])
  const surveys = sRes.rows

  for (const s of surveys) {
    const qRes = await db.query(
      `SELECT id, position, question_text, question_type, options, translations, required
       FROM survey_questions
       WHERE survey_id = $1
       ORDER BY position ASC`,
      [s.id]
    )
    s.questions = qRes.rows
  }

  return surveys
}

async function submitSurveyResponse(farmerId, surveyId, answersPayload) {
  // Check survey is active
  const sRes = await db.query(
    `SELECT s.id, s.title, s.status, s.target_type, s.target_value,
            f.farm_id, f.district, f.reservoir_id, f.tank_id
     FROM surveys s
     CROSS JOIN farmers f
     WHERE s.id = $1 AND f.farmer_id = $2 AND f.is_active`,
    [surveyId, farmerId]
  )
  if (sRes.rows.length === 0) {
    throw new Error('Survey not found or farmer account not active.')
  }
  const s = sRes.rows[0]
  if (s.status !== 'active') {
    throw new Error('This survey is no longer accepting responses.')
  }
  if (!isSurveyTargetedToFarmer(s, farmerId, s)) {
    throw new Error('This survey is not assigned to your account.')
  }

  // Check if already responded
  const existing = await db.query(
    'SELECT id FROM survey_responses WHERE survey_id = $1 AND farmer_id = $2',
    [surveyId, farmerId]
  )
  if (existing.rows.length > 0) {
    throw new Error('You have already submitted a response to this survey.')
  }

  // Get questions and validate answers
  const qRes = await db.query(
    'SELECT id, position, question_text, question_type, options, required FROM survey_questions WHERE survey_id = $1 ORDER BY position ASC',
    [surveyId]
  )
  const questions = qRes.rows
  const cleanedAnswers = {}

  for (const q of questions) {
    const qid = String(q.id)
    const ans = answersPayload?.[qid]

    if (q.required) {
      if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
        throw new Error(`Please answer question #${q.position + 1}: ${q.question_text}`)
      }
    }

    if (ans !== undefined && ans !== null && ans !== '') {
      if (q.question_type === 'choice') {
        const val = String(ans).trim()
        if (Array.isArray(q.options) && !q.options.includes(val)) {
          throw new Error(`Invalid option for question #${q.position + 1}`)
        }
        cleanedAnswers[qid] = val
      } else if (q.question_type === 'multi_choice') {
        const vals = Array.isArray(ans) ? ans.map((x) => String(x).trim()).filter(Boolean) : [String(ans).trim()]
        if (Array.isArray(q.options) && vals.some((v) => !q.options.includes(v))) {
          throw new Error(`Invalid option selected for question #${q.position + 1}`)
        }
        cleanedAnswers[qid] = vals
      } else if (q.question_type === 'yes_no') {
        const val = String(ans).trim().toLowerCase()
        if (val !== 'yes' && val !== 'no' && val !== 'true' && val !== 'false') {
          throw new Error(`Invalid answer for question #${q.position + 1}`)
        }
        cleanedAnswers[qid] = val === 'yes' || val === 'true' ? 'Yes' : 'No'
      } else if (q.question_type === 'number') {
        const n = Number(ans)
        if (isNaN(n)) {
          throw new Error(`Question #${q.position + 1} requires a valid number.`)
        }
        cleanedAnswers[qid] = Math.round(n * 100) / 100
      } else {
        cleanedAnswers[qid] = cleanString(String(ans), 1000)
      }
    }
  }

  const res = await db.query(
    `INSERT INTO survey_responses (survey_id, farmer_id, farm_id, answers)
     VALUES ($1, $2, $3, $4)
     RETURNING id, survey_id, farmer_id, farm_id, submitted_at`,
    [surveyId, farmerId, s.farm_id, JSON.stringify(cleanedAnswers)]
  )
  return res.rows[0]
}

module.exports = {
  validateSurveyPayload,
  isSurveyTargetedToFarmer,
  createSurvey,
  listSurveys,
  getSurveyDetails,
  setSurveyStatus,
  deleteSurvey,
  getActiveSurveysForFarmer,
  submitSurveyResponse
}
