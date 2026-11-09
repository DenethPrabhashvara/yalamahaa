const { test } = require('node:test')
const assert = require('node:assert/strict')
const { sendSms, validateSriLankanMobile } = require('../services/smsService.js')

test('validateSriLankanMobile handles local, international, spaced and dashed formats', () => {
  assert.equal(validateSriLankanMobile('0771234567').normalized, '94771234567')
  assert.equal(validateSriLankanMobile('+94 77 123 4567').normalized, '94771234567')
  assert.equal(validateSriLankanMobile('94-71-234-5678').normalized, '94712345678')
  assert.equal(validateSriLankanMobile('0112345678').valid, false)
})

test('sendSms in dry-run mode handles single recipient', async () => {
  process.env.SMS_DRY_RUN = 'true'
  const res = await sendSms('0771234567', 'Test message')
  assert.equal(res.status, 'success')
  assert.equal(res.dryRun, true)
  assert.equal(res.recipient, '94771234567')
})

test('sendSms in dry-run mode handles multiple recipients via array and comma string', async () => {
  process.env.SMS_DRY_RUN = 'true'
  const resArray = await sendSms(['0771234567', '0712345678'], 'Sinhala alert: ජල නිකුතුව')
  assert.equal(resArray.status, 'success')
  assert.equal(resArray.recipients, 2)
  assert.equal(resArray.delivered, 2)
  assert.equal(resArray.results[0].recipient, '94771234567')
  assert.equal(resArray.results[1].recipient, '94712345678')

  const resStr = await sendSms('0771234567, 0712345678', 'Tamil alert: நீர் விநியோகம்')
  assert.equal(resStr.status, 'success')
  assert.equal(resStr.recipients, 2)
  assert.equal(resStr.delivered, 2)
})
