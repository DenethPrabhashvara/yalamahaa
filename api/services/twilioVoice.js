// Placing a Twilio voice call with inline TwiML, over Twilio's REST API (no SDK needed).
// Credentials: TWILIO_ACCOUNT_SID + TWILIO_FROM_NUMBER, and either TWILIO_API_KEY + TWILIO_API_SECRET
// or TWILIO_AUTH_TOKEN.

function twilioLogin() {
  const { TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_AUTH_TOKEN } = process.env
  if (TWILIO_API_KEY && TWILIO_API_SECRET) return `${TWILIO_API_KEY}:${TWILIO_API_SECRET}`
  if (TWILIO_AUTH_TOKEN) return `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  return null
}

function twilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM_NUMBER && twilioLogin())
}

// 0771234567, 771234567, 94771234567 or +94771234567 -> +94771234567
function toE164(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '')
  if (/^\+\d{8,15}$/.test(digits)) return digits
  if (/^0\d{9}$/.test(digits)) return `+94${digits.slice(1)}`
  if (/^7\d{8}$/.test(digits)) return `+94${digits}`
  if (/^94\d{9}$/.test(digits)) return `+${digits}`
  return null
}

// Twilio errors that will fail every call the same way, so a batch should stop at the first one
// 20003 bad credentials, 21210/21212 bad caller number, 21215 country not allowed (Geo permissions)
const FATAL_CODES = new Set([20003, 20005, 21210, 21212, 21215])

/** Starts the call. Resolves to the call SID; throws an Error with .code and .fatal on failure. */
async function placeCall({ to, twiml, timeLimit = 60, ringSeconds = 30 }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER } = process.env
  if (!twilioConfigured()) {
    const err = new Error('Twilio is not set up (TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER and a key or auth token).')
    err.fatal = true
    throw err
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(twilioLogin()).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to, From: TWILIO_FROM_NUMBER, Twiml: twiml,
      Timeout: String(ringSeconds), TimeLimit: String(timeLimit),
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`Twilio ${body.code || res.status}: ${body.message || res.statusText}`)
    err.code = body.code
    err.fatal = FATAL_CODES.has(body.code) || res.status === 401
    throw err
  }
  return body.sid
}

module.exports = { twilioLogin, twilioConfigured, toE164, placeCall }
