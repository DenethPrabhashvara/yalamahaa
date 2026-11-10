const GROUPS = {
  higher_susceptibility: new Set(['high', 'very_high']),
  normal: new Set(['medium']),
  lower_susceptibility: new Set(['low', 'very_low']),
}

function exposureGroup(category) {
  if (GROUPS.higher_susceptibility.has(category)) return 'higher_susceptibility'
  if (GROUPS.normal.has(category)) return 'normal'
  if (GROUPS.lower_susceptibility.has(category)) return 'lower_susceptibility'
  return 'unknown'
}

const COPY = {
  en: {
    alert: {
      higher_susceptibility: 'Your farm is more flood-prone. Move livestock, pumps & seed uphill. Avoid flooded crossings.',
      normal: 'Floodwater may affect your area. Prepare to move livestock, pumps & seed. Avoid flooded crossings.',
      lower_susceptibility: 'Your farm is less flood-prone, but access routes may flood. Keep monitoring; avoid flooded crossings.',
      unknown: 'Your field risk is not mapped. Keep monitoring; avoid flooded crossings and follow local advice.',
    },
    major: {
      higher_susceptibility: 'Your farm is more flood-prone. Move people, livestock & seed to safe high ground now. Avoid crossings.',
      normal: 'Move people, livestock & seed to safe high ground now. Avoid flooded crossings.',
      lower_susceptibility: 'Your farm is less flood-prone, but routes may flood. Move to safety if needed; avoid crossings.',
      unknown: 'Move people and livestock to safety if needed. Avoid flooded crossings and follow local advice.',
    },
  },
  si: {
    alert: {
      higher_susceptibility: 'ඔබේ කුඹුරට ගංවතුර අවදානම වැඩියි. සතුන්, පොම්ප හා බීජ උස් තැනකට ගෙන යන්න. ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
      normal: 'ඔබේ ප්‍රදේශයට ගංවතුර බලපෑ හැකියි. සතුන්, පොම්ප හා බීජ ගෙන යාමට සූදානම් වන්න. ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
      lower_susceptibility: 'ඔබේ කුඹුරට අවදානම අඩු වුවත් යන මාර්ග ජලයෙන් යටවිය හැකියි. විමසිල්ලෙන් සිටින්න.',
      unknown: 'ඔබේ කුඹුරේ අවදානම තක්සේරු කර නැත. විමසිල්ලෙන් සිටින්න; ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
    },
    major: {
      higher_susceptibility: 'ඔබේ කුඹුරට ගංවතුර අවදානම වැඩියි. මිනිසුන්, සතුන් හා බීජ දැන්ම ආරක්ෂිත උස් තැනකට ගෙන යන්න.',
      normal: 'මිනිසුන්, සතුන් හා බීජ දැන්ම ආරක්ෂිත උස් තැනකට ගෙන යන්න. ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
      lower_susceptibility: 'ඔබේ කුඹුරට අවදානම අඩු වුවත් මාර්ග යටවිය හැකියි. අවශ්‍ය නම් ආරක්ෂිත තැනකට යන්න.',
      unknown: 'අවශ්‍ය නම් මිනිසුන් හා සතුන් ආරක්ෂිත තැනකට ගෙන යන්න. ජලයෙන් යටවූ මාර්ගවලින් නොයන්න.',
    },
  },
  ta: {
    alert: {
      higher_susceptibility: 'உங்கள் வயலுக்கு வெள்ள அபாயம் அதிகம். கால்நடைகள், பம்புகள், விதைகளை மேட்டுக்கு நகர்த்துங்கள். வெள்ளப் பாதைகளைக் கடக்காதீர்கள்.',
      normal: 'உங்கள் பகுதியை வெள்ளம் பாதிக்கலாம். கால்நடைகள், பம்புகள், விதைகளை நகர்த்தத் தயாராகுங்கள். வெள்ளப் பாதைகளைக் கடக்காதீர்கள்.',
      lower_susceptibility: 'உங்கள் வயலுக்கு அபாயம் குறைவு; அணுகும் பாதைகள் வெள்ளத்தில் மூழ்கலாம். தொடர்ந்து அவதானியுங்கள்.',
      unknown: 'உங்கள் வயலின் அபாயம் கணிக்கப்படவில்லை. தொடர்ந்து அவதானித்து, வெள்ளப் பாதைகளைக் கடக்காதீர்கள்.',
    },
    major: {
      higher_susceptibility: 'உங்கள் வயலுக்கு வெள்ள அபாயம் அதிகம். மக்களை, கால்நடைகளை, விதைகளை உடனே பாதுகாப்பான மேட்டுக்கு நகர்த்துங்கள்.',
      normal: 'மக்களை, கால்நடைகளை, விதைகளை உடனே பாதுகாப்பான மேட்டுக்கு நகர்த்துங்கள். வெள்ளப் பாதைகளைக் கடக்காதீர்கள்.',
      lower_susceptibility: 'உங்கள் வயலுக்கு அபாயம் குறைவு; பாதைகள் வெள்ளத்தில் மூழ்கலாம். தேவைப்பட்டால் பாதுகாப்பான இடத்துக்குச் செல்லுங்கள்.',
      unknown: 'தேவைப்பட்டால் மக்களையும் கால்நடைகளையும் பாதுகாப்பான இடத்துக்கு நகர்த்துங்கள். உள்ளூர் அறிவுறுத்தல்களைப் பின்பற்றுங்கள்.',
    },
  },
}

function buildFloodAlertMessage(kind, gauge, category) {
  const alertKind = kind === 'major' ? 'major' : 'alert'
  const exposure = exposureGroup(category)
  const levelName = alertKind === 'major'
    ? ['major flood level', 'ප්‍රධාන ගංවතුර මට්ටම', 'பெரு வெள்ள மட்டம்']
    : gauge.minor != null && gauge.sure >= gauge.minor
      ? ['minor flood level', 'සුළු ගංවතුර මට්ටම', 'சிறு வெள்ள மட்டம்']
      : ['alert level', 'අනතුරු මට්ටම', 'எச்சரிக்கை மட்டம்']
  const where = `${gauge.basin} - ${gauge.station}`
  const level = Number(gauge.level).toFixed(2)
  const alertNames = alertKind === 'major'
    ? ['MAJOR FLOOD', 'ප්‍රධාන ගංවතුර', 'பெரு வெள்ளம்']
    : ['FLOOD ALERT', 'ගංවතුර අනතුරු ඇඟවීම', 'வெள்ள எச்சரிக்கை']

  return [
    `Yala Maha: ${alertNames.join(' / ')}`,
    `${where}: ${level}m (${levelName.join(' / ')})`,
    `EN: ${COPY.en[alertKind][exposure]}`,
    `SI: ${COPY.si[alertKind][exposure]}`,
    `TA: ${COPY.ta[alertKind][exposure]}`,
  ].join('\n')
}

module.exports = { exposureGroup, buildFloodAlertMessage }
