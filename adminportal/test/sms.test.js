import assert from 'node:assert/strict'
import test from 'node:test'
import { renderSmsTemplate, SMS_TEMPLATES } from '../src/data/sms.js'

const sample = {
  levelEn: 'has reached the major flood level',
  levelSi: 'ප්‍රධාන ගංවතුර මට්ටමට ළඟා වී ඇත',
  levelTa: 'பெரு வெள்ள மட்டத்தை எட்டியுள்ளது',
  level: '5.20',
  river: 'Kelani Ganga',
  station: 'Nagalagam Street',
  scheme: 'Minneriya',
  date: '9 Nov',
  tank: 'Minneriya',
  percent: '94',
  name: 'Farmer Name',
}

test('every SMS template includes English, Sinhala and Tamil in one message', () => {
  for (const template of SMS_TEMPLATES) {
    const message = renderSmsTemplate(template, sample)
    assert.match(message, /^EN: /m, template.name)
    assert.match(message, /^SI: /m, template.name)
    assert.match(message, /^TA: /m, template.name)
    assert.doesNotMatch(message, /\{\{\w+\}\}/, template.name)
    assert.ok(message.length <= 640, `${template.name} exceeds the 640-character SMS limit`)
  }
})

test('the flood template includes the measured level and threshold wording in all languages', () => {
  const template = SMS_TEMPLATES.find(({ id }) => id === 'tpl-flood')
  const message = renderSmsTemplate(template, sample)
  assert.match(message, /Kelani Ganga has reached the major flood level at Nagalagam Street \(5\.20 m\)/)
  assert.match(message, /ප්‍රධාන ගංවතුර මට්ටමට ළඟා වී ඇත \(5\.20 m\)/)
  assert.match(message, /பெரு வெள்ள மட்டத்தை எட்டியுள்ளது \(5\.20 m\)/)
})
