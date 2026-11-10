// What farmers hear on a warning call, in English (Twilio's voice) and Sinhala (SinhalaVITS).
// Two kinds: a weather storm (services/stormForecast.js) and a tank the ML model expects to spill.
// Sinhala text avoids digits: SinhalaVITS reads words far more clearly than numbers.
// Pure: no database, no network.

const SI_WEEKDAYS = ['ඉරිදා', 'සඳුදා', 'අඟහරුවාදා', 'බදාදා', 'බ්‍රහස්පතින්දා', 'සිකුරාදා', 'සෙනසුරාදා']
const SI_IN_DAYS = { 3: 'තුනකින්', 4: 'හතරකින්', 5: 'පහකින්', 6: 'හයකින්', 7: 'හතකින්' }

// tanks in the model whose Sinhala name is well known; others are "the tank you get water from"
const SI_TANK_NAMES = {
  Giritale: 'ගිරිතලේ වැව', Huruluwewa: 'හුරුළු වැව', Kantale: 'කන්තලේ වැව', Kaudulla: 'කවුඩුල්ල වැව',
  Minneriya: 'මින්නේරිය වැව', Nachchaduwa: 'නාච්චදූව වැව', 'Nuwara Wewa': 'නුවර වැව', Padaviya: 'පදවිය වැව',
  'Parakrama Samudraya': 'පරාක්‍රම සමුද්‍රය', Rajangana: 'රාජාංගනය ජලාශය', Tissawewa: 'තිසා වැව',
}
const SI_YOUR_TANK = 'ඔබ ජලය ලබා ගන්නා වැව'

const weekdayOf = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const spokenDay = (iso) => new Date(`${iso}T00:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

// ---- weather storm ----

function weatherEnglish(storm) {
  const parts = []
  if (storm.kinds.includes('rain')) parts.push(`very heavy rain, about ${Math.round(storm.maxRain)} millimetres a day`)
  if (storm.kinds.includes('wind')) parts.push(`strong winds, with gusts up to ${Math.round(storm.maxGust)} kilometres an hour`)
  const what = parts.join(', and ')
  const away = storm.lead === 1 ? 'tomorrow' : `in ${storm.lead} days`
  const when = storm.start === storm.end
    ? `on ${spokenDay(storm.start)}, ${away}`
    : `from ${spokenDay(storm.start)} to ${spokenDay(storm.end)}, starting ${away}`
  return {
    main:
      `This is a weather warning from Yala Maha. ${what[0].toUpperCase()}${what.slice(1)} ` +
      `${parts.length > 1 ? 'are' : 'is'} forecast for your area ${when}. ` +
      'Please prepare now. Harvest any ready crops, move livestock, pumps and fertiliser to high ground, ' +
      'clear your field drains, and stay away from canals and tank bunds during the storm.',
    recap: `Again: ${storm.kinds.includes('rain') ? 'very heavy rain' : 'strong winds'} ${when}. Please prepare now.`,
  }
}

function weatherSinhala(storm) {
  const lead = storm.lead === 1 ? 'හෙට' : storm.lead === 2 ? 'අනිද්දා' : `තව දින ${SI_IN_DAYS[storm.lead] || 'කිහිපයකින්'}`
  const when = storm.start === storm.end
    ? `${lead}, ${SI_WEEKDAYS[weekdayOf(storm.start)]} දින`
    : `${lead}, ${SI_WEEKDAYS[weekdayOf(storm.start)]} දින සිට ${SI_WEEKDAYS[weekdayOf(storm.end)]} දින දක්වා`
  const rain = storm.kinds.includes('rain')
  const wind = storm.kinds.includes('wind')
  const hazard = rain && wind ? 'ඉතා අධික වැසි සහ තද සුළං' : rain ? 'ඉතා අධික වැසි' : 'තද සුළං'
  return (
    `මෙය යල මහ කාලගුණ අනතුරු ඇඟවීමකි. ${when}, ඔබගේ ප්‍රදේශයට ${hazard} ඇතිවිය හැකි බවට පුරෝකථනය කර ඇත. ` +
    'කරුණාකර දැන්ම සූදානම් වන්න. නෙළීමට සූදානම් අස්වනු නෙළා ගන්න. ' +
    'සතුන්, වතුර පොම්ප සහ පොහොර උස් ස්ථානවලට ගෙන යන්න. කුඹුරු කාණු පිරිසිදු කරන්න. ' +
    'කුණාටුව අතරතුර ඇළ මාර්ග සහ වැව් බැමිවලින් ඈත්ව සිටින්න. ' +
    `නැවතත් කියමි. ${when}, ${hazard}. කරුණාකර සූදානම් වන්න.`
  )
}

// ---- tank expected to spill (ML model) ----

function tankEnglish(o) {
  return {
    main:
      `This is a tank warning from Yala Maha. Our forecast model expects ${o.name} to fill to about ` +
      `${Math.round(o.predictedPct)} percent and spill within the next ${o.horizon} days. ` +
      'Please move livestock, pumps and equipment away from low ground below the tank, ' +
      "and follow the irrigation officers' advice about the spill gates.",
    recap: `Again: ${o.name} may spill within ${o.horizon} days.`,
  }
}

function tankSinhala(o) {
  const tank = SI_TANK_NAMES[o.name] || SI_YOUR_TANK
  const within = o.horizon === 14 ? 'ලබන සති දෙක ඇතුළත' : 'ඉදිරි දින කිහිපය ඇතුළත'
  return (
    `මෙය යල මහ වැව් අනතුරු ඇඟවීමකි. අපගේ පුරෝකථන ආකෘතියට අනුව, ${tank} ${within} පිරී වාන් දැමීමට ඉඩ ඇත. ` +
    'කරුණාකර වැවට පහළින් පහත් බිම්වල ඇති සතුන්, වතුර පොම්ප සහ උපකරණ උස් ස්ථානවලට ගෙන යන්න. ' +
    'වාන් දොරටු ගැන වාරිමාර්ග නිලධාරීන්ගේ උපදෙස් පිළිපදින්න. ' +
    `නැවතත් කියමි. ${tank} ${within} වාන් දැමීමට ඉඩ ඇත.`
  )
}

// ---- TwiML ----

const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// parts: [{ play: url } | { say: text } | { pause: seconds }]
function twiml(parts) {
  const body = parts.map((p) => {
    if (p.play) return `<Play>${xml(p.play)}</Play>`
    if (p.pause) return `<Pause length="${p.pause}"/>`
    return `<Say voice="Polly.Joanna" language="en-US">${xml(p.say)}</Say>`
  }).join('')
  return `<Response>${body}</Response>`
}

// rough talk time of English text read by Twilio, for the call's time limit
const englishSeconds = (text) => text.split(/\s+/).length / 2.5

module.exports = { SI_TANK_NAMES, weatherEnglish, weatherSinhala, tankEnglish, tankSinhala, twiml, englishSeconds }
