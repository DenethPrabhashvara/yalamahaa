// Unit tests for survey validation and processing (surveyService.js)
const test = require('node:test')
const assert = require('node:assert/strict')

const db = require('../config/db.js')
const {
  validateSurveyPayload,
  isSurveyTargetedToFarmer,
  getActiveSurveysForFarmer
} = require('../services/surveyService.js')

test.after(() => db.pool?.end().catch(() => {}))

test('validateSurveyPayload: valid flood damage survey passes with all question types', () => {
  const payload = {
    title: 'Flood Damage Assessment - Polonnaruwa',
    description: 'Emergency crop loss evaluation following heavy Mahaweli rainfall',
    category: 'flood',
    target: {
      type: 'district',
      value: 'Polonnaruwa',
      label: 'District: Polonnaruwa'
    },
    questions: [
      {
        question_text: 'What is the condition of your paddy crop?',
        question_type: 'choice',
        options: ['No damage', 'Partially submerged', 'Completely destroyed'],
        required: true
      },
      {
        question_text: 'Estimated submerged area in acres',
        question_type: 'number',
        required: true
      },
      {
        question_text: 'Is your farm currently accessible by road?',
        question_type: 'yes_no',
        required: true
      },
      {
        question_text: 'Immediate assistance needed',
        question_type: 'multi_choice',
        options: ['Emergency seeds', 'Water pump', 'Fertilizer support', 'Bund repair assistance'],
        required: false
      },
      {
        question_text: 'Additional remarks or urgent needs',
        question_type: 'text',
        required: false
      }
    ]
  }

  const result = validateSurveyPayload(payload)
  assert.equal(result.title, 'Flood Damage Assessment - Polonnaruwa')
  assert.equal(result.category, 'flood')
  assert.equal(result.target_type, 'district')
  assert.equal(result.target_value, 'Polonnaruwa')
  assert.equal(result.questions.length, 5)
  assert.equal(result.questions[0].question_type, 'choice')
  assert.deepEqual(result.questions[0].options, ['No damage', 'Partially submerged', 'Completely destroyed'])
  assert.equal(result.questions[1].question_type, 'number')
  assert.equal(result.questions[2].question_type, 'yes_no')
  assert.equal(result.questions[3].question_type, 'multi_choice')
  assert.equal(result.questions[4].question_type, 'text')
  assert.equal(result.questions[4].required, false)
})

test('survey audience matching only accepts farmers included by each targeting rule', () => {
  const farmer = {
    district: 'Polonnaruwa',
    reservoir_id: 12,
    tank_id: 34
  }

  assert.equal(isSurveyTargetedToFarmer({ target_type: 'all' }, 'farmer-1', farmer), true)
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'district', target_value: 'polonnaruwa' }, 'farmer-1', farmer), true)
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'district', target_value: 'Ampara' }, 'farmer-1', farmer), false)
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'reservoir', target_value: 12 }, 'farmer-1', farmer), true)
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'reservoir', target_value: 13 }, 'farmer-1', farmer), false)
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'tank', target_value: '34' }, 'farmer-1', farmer), true)
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'farmers', target_value: ['farmer-2'] }, 'farmer-1', farmer), false)
  assert.equal(
    isSurveyTargetedToFarmer(
      { target_type: 'farmers', target_value: ['3FEEFEC6-ACCF-416C-8FB5-405466BAB6CA'] },
      '3feefec6-accf-416c-8fb5-405466bab6ca',
      farmer
    ),
    true
  )
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'unknown' }, 'farmer-1', farmer), false)
  assert.equal(isSurveyTargetedToFarmer({ target_type: 'tank', target_value: null }, 'farmer-1', { ...farmer, tank_id: null }), false)
})

test('active farmer survey query matches selected farmer IDs as JSON array elements', async () => {
  const originalQuery = db.query
  db.query = async (sql, params) => {
    assert.match(sql, /jsonb_typeof\(s\.target_value\) = 'array'/)
    assert.match(sql, /s\.target_value @> jsonb_build_array\(f\.farmer_id::text\)/)
    assert.deepEqual(params, ['3feefec6-accf-416c-8fb5-405466bab6ca'])
    return { rows: [] }
  }

  try {
    assert.deepEqual(await getActiveSurveysForFarmer('3feefec6-accf-416c-8fb5-405466bab6ca'), [])
  } finally {
    db.query = originalQuery
  }
})

test('validateSurveyPayload: validates specific farmer selection targeting', () => {
  const payload = {
    title: 'Individual Relief Survey',
    target: {
      type: 'farmers',
      value: ['3feefec6-accf-416c-8fb5-405466bab6ca', 'e29958b1-3b46-432f-9639-bbe9e687ac12']
    },
    questions: [
      {
        question_text: 'Are you safe?',
        question_type: 'yes_no'
      }
    ]
  }

  const result = validateSurveyPayload(payload)
  assert.equal(result.target_type, 'farmers')
  assert.equal(result.target_value.length, 2)
  assert.equal(result.target_label, '2 Selected Farmers')
})

test('validateSurveyPayload: rejects invalid titles or empty questions', () => {
  assert.throws(() => {
    validateSurveyPayload({ title: '  ', target: { type: 'all' }, questions: [] })
  }, /Survey title is required/)

  assert.throws(() => {
    validateSurveyPayload({ title: 'Valid Title', target: { type: 'all' }, questions: [] })
  }, /Survey must contain at least one question/)
})

test('validateSurveyPayload: validates choices require at least 2 options', () => {
  assert.throws(() => {
    validateSurveyPayload({
      title: 'Invalid Choices',
      target: { type: 'all' },
      questions: [
        {
          question_text: 'Pick one',
          question_type: 'choice',
          options: ['Only one']
        }
      ]
    })
  }, /requires at least 2 options/)
})

test('validateSurveyPayload: preserves bounded Sinhala and Tamil survey and question translations', () => {
  const result = validateSurveyPayload({
    title: 'Flood Survey',
    translations: {
      si: { title: 'ගංවතුර සමීක්ෂණය', description: 'කුඹුරේ තත්ත්වය' },
      ta: { title: 'வெள்ளக் கணக்கெடுப்பு', description: 'வயல் நிலை' }
    },
    target: { type: 'all' },
    questions: [{
      question_text: 'Is your field flooded?',
      question_type: 'choice',
      options: ['Yes', 'No'],
      translations: {
        si: { question_text: 'ඔබේ කුඹුර ජලයෙන් යටවී තිබේද?', options: ['ඔව්', 'නැත'] },
        ta: { question_text: 'உங்கள் வயல் நீரில் மூழ்கியுள்ளதா?', options: ['ஆம்', 'இல்லை'] }
      }
    }]
  })

  assert.deepEqual(result.translations, {
    si: { title: 'ගංවතුර සමීක්ෂණය', description: 'කුඹුරේ තත්ත්වය' },
    ta: { title: 'வெள்ளக் கணக்கெடுப்பு', description: 'வயல் நிலை' }
  })
  assert.deepEqual(result.questions[0].translations, {
    si: { question_text: 'ඔබේ කුඹුර ජලයෙන් යටවී තිබේද?', options: ['ඔව්', 'නැත'] },
    ta: { question_text: 'உங்கள் வயல் நீரில் மூழ்கியுள்ளதா?', options: ['ஆம்', 'இல்லை'] }
  })
})

test('validateSurveyPayload: rejects translated option lists that do not match English choices', () => {
  assert.throws(() => validateSurveyPayload({
    title: 'Flood Survey',
    target: { type: 'all' },
    questions: [{
      question_text: 'Is your field flooded?',
      question_type: 'choice',
      options: ['Yes', 'No'],
      translations: { si: { question_text: 'කුඹුර ජලයෙන් යටවීද?', options: ['ඔව්'] } }
    }]
  }), /option translations must match/)
})

test('validateSurveyPayload: validates target types and values', () => {
  assert.throws(() => {
    validateSurveyPayload({
      title: 'Invalid Target',
      target: { type: 'invalid_type' },
      questions: [{ question_text: 'Q1', question_type: 'yes_no' }]
    })
  }, /Invalid target type/)

  assert.throws(() => {
    validateSurveyPayload({
      title: 'Invalid Reservoir',
      target: { type: 'reservoir', value: 'not-a-number' },
      questions: [{ question_text: 'Q1', question_type: 'yes_no' }]
    })
  }, /valid reservoir ID/)

  assert.throws(() => {
    validateSurveyPayload({
      title: 'Invalid Farmers',
      target: { type: 'farmers', value: ['not-a-uuid'] },
      questions: [{ question_text: 'Q1', question_type: 'yes_no' }]
    })
  }, /Invalid farmer ID/)
})
