const test = require('node:test')
const assert = require('node:assert')
const { covered, buildCall, settings } = require('../services/stormCallJob.js')

test('a storm moved by a day, or the same tank, is not rung twice', () => {
  const had = [
    { farmer_id: 'a', source: 'weather', subject: null, event_date: '2026-11-10' },
    { farmer_id: 'a', source: 'ml', subject: 'Minneriya', event_date: '2026-11-20' },
  ]
  assert.ok(covered(had, 'a', { source: 'weather', eventDate: '2026-11-11' }))
  assert.ok(!covered(had, 'a', { source: 'weather', eventDate: '2026-11-13' }))
  assert.ok(!covered(had, 'b', { source: 'weather', eventDate: '2026-11-11' }))
  assert.ok(covered(had, 'a', { source: 'ml', subject: 'Minneriya' }))
  assert.ok(!covered(had, 'a', { source: 'ml', subject: 'Giritale' }))
})

test('English only call needs no SinhalaVITS', async () => {
  const s = settings({ STORM_CALL_LANG: 'en', STORM_CALL_MODE: 'live', PUBLIC_API_URL: 'https://h' })
  const c = await buildCall({ key: 'k', en: { main: 'Main text.', recap: 'Again.' }, si: 'x' }, s)
  assert.strictEqual(c.lang, 'en')
  assert.match(c.twiml, /^<Response><Play>https:\/\/h\/api\/voice\/hazard-tone\.wav<\/Play><Say[^>]*>Main text\.<\/Say><Pause length="1"\/><Say[^>]*>Again\.<\/Say><\/Response>$/)
})

test('Sinhala falls back to English when SinhalaVITS is unreachable', async () => {
  process.env.SINHALA_TTS_URL = 'http://127.0.0.1:9' // nothing listens there
  delete require.cache[require.resolve('../services/sinhalaTts.js')]
  delete require.cache[require.resolve('../services/stormCallJob.js')]
  const job = require('../services/stormCallJob.js')
  const c = await job.buildCall({ key: 'k2', en: { main: 'Main.', recap: 'Again.' }, si: 'සිංහල' }, job.settings({ STORM_CALL_LANG: 'si' }))
  assert.strictEqual(c.lang, 'en')
  assert.match(c.note, /SinhalaVITS failed/)
  assert.match(c.twiml, /<Say[^>]*>Main\.<\/Say>/)
})
