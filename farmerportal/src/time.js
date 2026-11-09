// Date and time formatting shared across screens. Everything is shown in Sri Lanka time,
// whatever the phone's own timezone says, because every reading and warning the app shows
// is about here.
//
// `fmtDay` in components/ForecastChart.jsx handles plain YYYY-MM-DD dates and stays there;
// these take full ISO timestamps, which it cannot.

export const LOCALES = { en: 'en-GB', si: 'si-LK', ta: 'ta-LK' };
const TZ = 'Asia/Colombo';
const formatters = new Map();
const monthFormatters = new Map();
const SI_MONTHS = [
  'ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි',
  'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්',
];

function formatterFor(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  if (!formatters.has(key)) formatters.set(key, new Intl.DateTimeFormat(locale, options));
  return formatters.get(key);
}

/** Format a date in the selected language, supplying Sinhala month names where browser ICU lacks them. */
export function localizedDate(date, lang, options) {
  const locale = LOCALES[lang] || LOCALES.en;
  const parts = formatterFor(locale, options).formatToParts(date);
  if (lang !== 'si' || !parts.some((part) => part.type === 'month')) return parts.map((part) => part.value).join('');

  const timeZone = options.timeZone || undefined;
  const monthKey = timeZone || 'local';
  if (!monthFormatters.has(monthKey)) {
    monthFormatters.set(monthKey, new Intl.DateTimeFormat('en', { month: 'numeric', ...(timeZone ? { timeZone } : {}) }));
  }
  const month = Number(monthFormatters.get(monthKey).format(date));
  return parts.map((part) => (part.type === 'month' ? SI_MONTHS[month - 1] : part.value)).join('');
}

/** "14:21" in Sri Lanka time. */
export function hhmm(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

/** "3 Nov, 14:21" in the farmer's language. */
export function fmtDateTime(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return localizedDate(d, lang, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });
}

/**
 * "just now", "20 min ago", "3 h ago", "2 days ago", then the date.
 * `t` takes a key and no arguments, so the number is concatenated rather than interpolated.
 */
export function timeAgo(iso, t, lang) {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 0) return fmtDateTime(iso, lang); // issued for later: show the time itself
  if (secs < 60) return t('justNow');
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} ${t('minAgo')}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} ${t('hrAgo')}`;
  const days = Math.round(hrs / 24);
  if (days <= 7) return `${days} ${t('daysAgo')}`;
  return fmtDateTime(iso, lang);
}
