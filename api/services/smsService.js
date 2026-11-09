/**
 * Text.lk SMS Gateway Integration & Farmer Messaging Services
 * ------------------------------------------------------------
 * Features:
 * - Direct carrier integration via Text.lk API v3
 * - Strict Sri Lankan mobile format validation (zero credits wasted on bad numbers)
 * - Dry-run toggle to protect SMS credit balance
 */

/**
 * Validate Sri Lankan mobile phone numbers strictly
 * Allows: 07XXXXXXXX, +947XXXXXXXX, 947XXXXXXXX, formatted with spaces or dashes
 */
function validateSriLankanMobile(rawPhone) {
  let cleaned = String(rawPhone || '').trim().replace(/[\s\-+]/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '94' + cleaned.slice(1)
  }

  // Sri Lankan Mobile: 94 + (70, 71, 72, 74, 75, 76, 77, 78) + 7 digits = 11 digits
  const mobileRegex = /^94(7[01245678])\d{7}$/
  if (!mobileRegex.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      error: 'Invalid mobile number. Must be a valid 10-digit mobile (e.g. :  077 123 4567).'
    }
  }

  return { valid: true, normalized: cleaned }
}

function normalizePhoneNumber(phone) {
  const result = validateSriLankanMobile(phone)
  return result.normalized
}

/**
 * Dispatch single SMS via Text.lk API v3
 */
async function sendSingleSms(recipientStr, message, { forceLive, senderId, token, type }) {
  const isDryRun = forceLive ? false : process.env.SMS_DRY_RUN === 'true'

  if (isDryRun) {
    console.log(`[SMS DRY RUN] To: ${recipientStr} | Message: "${message}"`)
    return {
      status: 'success',
      dryRun: true,
      recipient: recipientStr,
      message,
    }
  }

  const response = await fetch('https://app.text.lk/api/v3/sms/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      recipient: recipientStr,
      sender_id: senderId,
      type,
      message,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Message API error (${response.status}): ${JSON.stringify(data)}`)
  }
  return data
}

/**
 * Dispatch SMS via Text.lk API v3 (supports single or multi-recipients, plain and unicode)
 */
async function sendSms(recipients, message, options = {}) {
  const rawList = Array.isArray(recipients)
    ? recipients.flat()
    : String(recipients || '').split(',')
  const list = rawList.map(r => String(r || '').trim()).filter(Boolean)

  if (list.length === 0) {
    throw new Error('No valid Sri Lankan mobile numbers provided.')
  }

  const validRecipients = []
  for (const item of list) {
    const chk = validateSriLankanMobile(item)
    if (chk.valid) validRecipients.push(chk.normalized)
  }

  if (validRecipients.length === 0) {
    throw new Error('No valid Sri Lankan mobile numbers provided.')
  }

  const isDryRun = options.forceLive ? false : process.env.SMS_DRY_RUN === 'true'
  const token = process.env.TEXTLK_API_TOKEN
  if (!isDryRun && !token) {
    throw new Error('TEXTLK_API_TOKEN is not configured.')
  }

  const senderId = process.env.TEXTLK_SENDER_ID || 'yala-maha'
  const type = /[^\u0000-\u007F]/.test(message) ? 'unicode' : 'plain'

  if (validRecipients.length === 1) {
    return await sendSingleSms(validRecipients[0], message, {
      forceLive: options.forceLive, senderId, token, type
    })
  }

  const results = []
  let delivered = 0
  for (const recipient of validRecipients) {
    try {
      const res = await sendSingleSms(recipient, message, {
        forceLive: options.forceLive, senderId, token, type
      })
      delivered += 1
      results.push({ recipient, status: 'success', data: res })
    } catch (err) {
      results.push({ recipient, status: 'fail', error: err.message })
    }
  }

  return {
    status: 'success',
    recipients: validRecipients.length,
    delivered,
    results
  }
}

/**
 * Dispatch confirmation SMS after farmer completes registration
 */

async function sendRegistrationConfirmation(phone, { farmerName, acres }, options = {}) {
  const phoneCheck = validateSriLankanMobile(phone)
  if (!phoneCheck.valid) {
    throw new Error(phoneCheck.error)
  }
  const normalized = phoneCheck.normalized
  const name = farmerName || 'Farmer'
  const totalAcres = acres ? `${acres} ac` : 'registered area'
  const message = `Yala Maha: Welcome ${name}! Farm of land (${totalAcres}) acres is registered for irrigation schedules & flood alerts.`

  return await sendSms(normalized, message, options)
}

// read-only Text.lk calls: one message's delivery status, and the account balance
async function textlkGet(path) {
  const token = process.env.TEXTLK_API_TOKEN
  if (!token) throw new Error('TEXTLK_API_TOKEN is not configured.')
  const response = await fetch(`https://app.text.lk/api/v3${path}`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.status === 'error') {
    throw new Error(`Message API error (${response.status}): ${data.message || 'no details'}`)
  }
  return data.data
}

const getSmsStatus = (uid) => textlkGet(`/sms/${encodeURIComponent(uid)}`)
const getBalance = () => textlkGet('/balance')

module.exports = {
  sendSms,
  getSmsStatus,
  getBalance,
  normalizePhoneNumber,
  validateSriLankanMobile,
  sendRegistrationConfirmation
}
