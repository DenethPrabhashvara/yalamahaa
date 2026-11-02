// Voice flood alert demo for the farmer web app (/api/voice-demo)
//   POST /call  { lang: 'en' | 'si' }  phones the demo number with the flood alert in that language
// Only ever calls VOICE_DEMO_NUMBER (set on the server), never a number from the request.
const express = require('express')
const rateLimit = require('express-rate-limit')

const voicedemorouter = express.Router()

const DEMO_NUMBER = process.env.VOICE_DEMO_NUMBER || '+94774817583'
const PUBLIC_URL = process.env.PUBLIC_API_URL || 'https://farmer.yalamaha.aurawebsolution.online'
const MESSAGE_EN = 'Emergency alert from Yala Maha. A flood is expected in your area within the next few days. Please move to a safe place.'
const say = `<Say voice="Polly.Joanna" language="en-US">${MESSAGE_EN}</Say>`
const TWIML = {
  en: `<Response><Play>${PUBLIC_URL}/api/voice/hazard-tone.wav</Play>${say}<Pause length="1"/>${say}</Response>`,
  si: `<Response><Play>${PUBLIC_URL}/api/voice/flood-alert-si.wav</Play><Pause length="1"/><Play>${PUBLIC_URL}/api/voice/flood-alert-si.wav</Play></Response>`
}

// API key + secret, or else the account's auth token
function twilioLogin() {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_AUTH_TOKEN } = process.env
  if (TWILIO_API_KEY && TWILIO_API_SECRET) return `${TWILIO_API_KEY}:${TWILIO_API_SECRET}`
  if (TWILIO_AUTH_TOKEN) return `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  return null
}

// one call a minute from anyone, so the demo can't run up the Twilio bill
const callLimiter = rateLimit({ windowMs: 60 * 1000, limit: 1, standardHeaders: true, legacyHeaders: false, keyGenerator: () => 'voice-demo',
  message: { status: 'fail', message: 'A demo call was just placed. Try again in a minute.' } })

voicedemorouter.post('/call', callLimiter, async (req, res, next) => {
  try {
    const lang = req.body?.lang === 'si' ? 'si' : 'en'
    const { TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER } = process.env
    if (!TWILIO_ACCOUNT_SID || !TWILIO_FROM_NUMBER || !twilioLogin()) {
      return res.status(503).json({ status: 'fail', message: 'Voice calls are not set up on the server.' })
    }
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(twilioLogin()).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: DEMO_NUMBER, From: TWILIO_FROM_NUMBER, Twiml: TWIML[lang], Timeout: '30', TimeLimit: '30' })
    })
    const body = await r.json()
    if (!r.ok) return res.status(502).json({ status: 'fail', message: `Twilio: ${body.message || r.status}.` })
    res.json({ status: 'success', data: { sid: body.sid, lang } })
  } catch (e) {
    next(e)
  }
})

module.exports = voicedemorouter
