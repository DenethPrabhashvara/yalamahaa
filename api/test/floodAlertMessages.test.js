const test = require('node:test')
const assert = require('node:assert/strict')
const { exposureGroup, buildFloodAlertMessage } = require('../services/floodAlertMessages.js')

test('exposureGroup maps DEM susceptibility categories, not operational gauge stages', () => {
  assert.equal(exposureGroup('very_high'), 'higher_susceptibility')
  assert.equal(exposureGroup('high'), 'higher_susceptibility')
  assert.equal(exposureGroup('medium'), 'normal')
  assert.equal(exposureGroup('low'), 'lower_susceptibility')
  assert.equal(exposureGroup('very_low'), 'lower_susceptibility')
  assert.equal(exposureGroup(null), 'unknown')
})

test('trilingual alert messages adapt advice by susceptibility without changing gauge facts', () => {
  const gauge = { basin: 'Mahaweli Ganga', station: 'Peradeniya', level: 2.4, sure: 2.3, minor: 3, major: 5 }
  const exposed = buildFloodAlertMessage('alert', gauge, 'high')
  const typical = buildFloodAlertMessage('alert', gauge, 'medium')
  const lessExposed = buildFloodAlertMessage('alert', gauge, 'very_low')
  const unmapped = buildFloodAlertMessage('alert', gauge, null)

  assert.match(exposed, /2\.40m/)
  assert.match(exposed, /more flood-prone/)
  assert.match(exposed, /SI: .*කුඹුරට/)
  assert.match(exposed, /TA: .*வயலுக்கு/)
  assert.match(typical, /Floodwater may affect your area/)
  assert.match(typical, /SI: .*ගංවතුර/)
  assert.match(typical, /TA: .*வெள்ளம்/)
  assert.match(lessExposed, /less flood-prone, but access routes may flood/)
  assert.match(unmapped, /risk is not mapped/)
  assert.doesNotMatch(lessExposed, /\bsafe\b/i)
})

test('major alerts provide urgent instructions in all three SMS languages', () => {
  const gauge = { basin: 'Kelani Ganga', station: 'Nagalagam Street', level: 5.2, sure: 5.1, minor: 3.2, major: 5 }
  const message = buildFloodAlertMessage('major', gauge, 'very_high')

  assert.match(message, /MAJOR FLOOD/)
  assert.match(message, /EN: .*Move people, livestock & seed/)
  assert.match(message, /ප්‍රධාන ගංවතුර/)
  assert.match(message, /SI: .*ආරක්ෂිත උස් තැනකට/)
  assert.match(message, /பெரு வெள்ளம்/)
  assert.match(message, /TA: .*பாதுகாப்பான மேட்டுக்கு/)
})
