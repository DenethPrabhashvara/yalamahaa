const test = require('node:test')
const assert = require('node:assert')
const w = require('../services/alertMessages.js')
const { simulatedStorm, thresholds } = require('../services/stormForecast.js')

const storm = simulatedStorm('2026-11-07', thresholds({})) // Wednesday 11 November, 4 days ahead

test('English weather message', () => {
  const m = w.weatherEnglish(storm)
  assert.match(m.main, /Very heavy rain, about 150 millimetres a day, and strong winds.* are forecast for your area on Wednesday 11 November, in 4 days\./)
  assert.ok((m.main + ' ' + m.recap).split(/\s+/).length / 2.5 < 55)
})

test('Sinhala weather message: day words, no digits', () => {
  const si = w.weatherSinhala(storm)
  assert.match(si, /තව දින හතරකින්, බදාදා දින/)
  assert.match(si, /ඉතා අධික වැසි සහ තද සුළං/)
  assert.doesNotMatch(si, /[0-9A-Za-z]/)
  assert.match(w.weatherSinhala({ ...storm, lead: 1, kinds: ['wind'] }), /^.*හෙට, බදාදා දින.*තද සුළං/)
  assert.match(w.weatherSinhala({ ...storm, lead: 2, end: '2026-11-12' }), /අනිද්දා, බදාදා දින සිට බ්‍රහස්පතින්දා දින දක්වා/)
})

test('tank messages', () => {
  const o = { name: 'Minneriya', predictedPct: 103.6, horizon: 14 }
  assert.match(w.tankEnglish(o).main, /expects Minneriya to fill to about 104 percent and spill within the next 14 days/)
  assert.match(w.tankSinhala(o), /මින්නේරිය වැව ලබන සති දෙක ඇතුළත පිරී වාන් දැමීමට/)
  // unknown tanks are never read out in English letters
  const other = w.tankSinhala({ ...o, name: 'Alugalge' })
  assert.match(other, /ඔබ ජලය ලබා ගන්නා වැව/)
  assert.doesNotMatch(other, /[0-9A-Za-z]/)
})

test('TwiML escapes and orders parts', () => {
  const x = w.twiml([{ play: 'https://h/a.wav?x=1&y=2' }, { pause: 1 }, { say: 'Tom & <Jerry>' }])
  assert.strictEqual(x, '<Response><Play>https://h/a.wav?x=1&amp;y=2</Play><Pause length="1"/><Say voice="Polly.Joanna" language="en-US">Tom &amp; &lt;Jerry&gt;</Say></Response>')
})
