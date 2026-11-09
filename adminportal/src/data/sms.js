// SMS campaigns sent from this portal (GET /admin/sms/campaigns)

export const SMS_TEMPLATES = [
  {
    id: 'tpl-flood',
    name: 'Flood warning',
    category: 'Emergency',
    body: [
      'EN: Yala Maha FLOOD ALERT: {{river}} {{levelEn}} at {{station}} ({{level}} m). Move livestock to higher ground and avoid flooded roads.',
      'SI: Yala Maha ගංවතුර අනතුරු ඇඟවීම: {{river}} හි {{station}} මිනුම් ස්ථානය {{levelSi}} ({{level}} m). සතුන් උස් බිමකට ගෙන ගොස් ජලයෙන් යටවූ මාර්ගවලින් ඉවත් වන්න.',
      'TA: Yala Maha வெள்ள எச்சரிக்கை: {{river}} ஆற்றின் {{station}} நிலையம் {{levelTa}} ({{level}} m). கால்நடைகளை மேட்டுக்கு நகர்த்தி, வெள்ளப் பாதைகளைத் தவிர்க்கவும்.',
    ].join('\n'),
  },
  {
    id: 'tpl-release',
    name: 'Water release notice',
    category: 'Irrigation',
    body: [
      'EN: Yala Maha: Water release for {{scheme}} begins on {{date}}. Please prepare your field channels.',
      'SI: Yala Maha: {{scheme}} යෝජනා ක්‍රමය සඳහා ජලය {{date}} දින නිකුත් කිරීම ආරම්භ වේ. ඔබේ කුඹුරු ඇළ මාර්ග සූදානම් කරගන්න.',
      'TA: Yala Maha: {{scheme}} திட்டத்திற்கான நீர் {{date}} அன்று திறக்கப்படும். உங்கள் வயல் வாய்க்கால்களைத் தயார் செய்யுங்கள்.',
    ].join('\n'),
  },
  {
    id: 'tpl-tank',
    name: 'Tank level',
    category: 'Irrigation',
    body: [
      'EN: Yala Maha: {{tank}} is at {{percent}}% storage. Plan your water use with your farmer organisation.',
      'SI: Yala Maha: {{tank}} ජලාශයේ ජලය ධාරිතාවෙන් {{percent}}% කි. ගොවි සංවිධානය සමඟ ජල භාවිතය සැලසුම් කරන්න.',
      'TA: Yala Maha: {{tank}} நீர்த்தேக்கத்தில் {{percent}}% நீர் உள்ளது. விவசாய அமைப்புடன் நீர் பயன்பாட்டைத் திட்டமிடுங்கள்.',
    ].join('\n'),
  },
  {
    id: 'tpl-advisory',
    name: 'Crop advisory',
    category: 'Agronomy',
    body: [
      'EN: Yala Maha CROP ADVISORY: Dear {{name}}, follow the latest advice from your local agriculture officer.',
      'SI: Yala Maha වගා උපදෙස්: {{name}} මහත්මයා/මහත්මිය, ඔබේ ප්‍රදේශයේ කෘෂිකර්ම නිලධාරියාගේ නවතම උපදෙස් පිළිපදින්න.',
      'TA: Yala Maha பயிர் ஆலோசனை: {{name}}, உங்கள் பகுதி விவசாய அலுவலரின் சமீபத்திய ஆலோசனையைப் பின்பற்றுங்கள்.',
    ].join('\n'),
  },
]

export function renderSmsTemplate(template, values) {
  return template.body.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match)
}

// delivered = accepted by Text.lk; handset_* = Text.lk's report of what reached the phone.
// tracked = messages with a Text.lk id (0 for dry runs and campaigns sent before tracking)
const STATUS = (c) => {
  if (c.dry_run) return 'Dry run'
  if (!c.tracked) return c.failed === 0 ? 'Accepted' : c.delivered === 0 ? 'Failed' : 'Partly sent'
  if (c.pending) return 'Sending'
  if (c.reached === c.recipients) return 'Delivered'
  return c.reached === 0 ? 'Failed' : 'Partly delivered'
}

// Local calendar day, YYYY-MM-DD
const dayKey = (date) => date.toLocaleDateString('en-CA')

export function buildSms(rows = [], now = new Date()) {
  const CAMPAIGNS = rows.map((row) => {
    const c = {
      ...row,
      sentAt: new Date(row.created_at),
      reached: row.handset_delivered ?? 0,
      pending: row.handset_pending ?? 0,
      // not accepted by Text.lk, plus accepted but not delivered
      failedAll: row.failed + (row.handset_failed ?? 0),
    }
    return { ...c, status: STATUS(c) }
  })
  // real sends only; dry runs never left the server
  const live = CAMPAIGNS.filter((c) => !c.dry_run)

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const sumOf = (items, field) => items.reduce((total, item) => total + (item[field] || 0), 0)
  const today = live.filter((c) => c.sentAt >= startOfToday)
  const month = live.filter((c) => c.sentAt >= startOfMonth)
  const tracked = live.filter((c) => c.tracked)
  const settled = sumOf(tracked, 'reached') + sumOf(tracked, 'failedAll')

  // The last 7 days, oldest first
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfToday)
    date.setDate(date.getDate() - (6 - index))
    return date
  })
  const SMS_VOLUME_TREND = days.map((date) => {
    const items = live.filter((c) => dayKey(c.sentAt) === dayKey(date))
    return {
      day: date.toLocaleDateString('en-GB', { weekday: 'short' }),
      sent: sumOf(items, 'recipients'),
      // accepted and not reported failed later, so a message is never counted twice
      delivered: sumOf(items, 'delivered') - sumOf(items, 'handset_failed'),
      failed: sumOf(items, 'failedAll'),
    }
  })

  return {
    CAMPAIGNS,
    SMS_VOLUME_TREND,
    SMS_SUMMARY: {
      campaigns: CAMPAIGNS.length,
      sentToday: sumOf(today, 'delivered'),
      sentMonth: sumOf(month, 'delivered'),
      failedMonth: sumOf(month, 'failedAll'),
      reached: sumOf(tracked, 'reached'),
      pending: sumOf(tracked, 'pending'),
      failed: sumOf(live, 'failedAll'),
      cost: sumOf(live, 'cost'),
      // of messages whose fate is known, how many reached the phone
      deliveryRate: settled ? Number(((sumOf(tracked, 'reached') / settled) * 100).toFixed(1)) : null,
      lastSent: live[0]?.sentAt || null,
    },
  }
}
