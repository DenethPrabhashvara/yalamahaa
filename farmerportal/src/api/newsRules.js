// Pure rules for weather advisories: no imports, no I/O, no React, so they can be run
// and tested on their own (the backend's services/capParse.js is kept pure for the same
// reason). api/news.js re-exports all of this.

/**
 * Recomputed on render rather than trusted from the response: useApiData holds data for
 * 10 minutes, so a warning can lapse while it is still sitting in the cache.
 */
export function isExpired(item) {
  if (!item?.expires) return false;
  const until = Date.parse(item.expires);
  return Number.isFinite(until) && until <= Date.now();
}

/** Warnings still in force, in the order the server sent them. */
export function activeNews(items) {
  return (items || []).filter((n) => !isExpired(n));
}

/**
 * The one warning that earns the red banner, or null.
 *
 * The server decides what is banner-worthy. This adds two refusals the client is better
 * placed to make: never banner something that has lapsed, and never banner something
 * issued more than 48 hours ago, so a stuck feed cannot leave a red banner up for days.
 */
export function bannerNews(items) {
  const MAX_BANNER_MS = 48 * 60 * 60 * 1000;
  return activeNews(items).find((n) => {
    if (!n.banner || !n.expires) return false;
    const sent = Date.parse(n.sent);
    return !Number.isFinite(sent) || Date.now() - sent < MAX_BANNER_MS;
  }) || null;
}

/**
 * Matched on the English event name, which is always present even when the warning text
 * came back in Sinhala or Tamil — so the icon can't break for those languages.
 */
export function newsIcon(item) {
  const e = `${item?.eventEn || item?.event || ''}`.toLowerCase();
  if (/cyclon|wind|gale|storm/.test(e)) return 'wind';
  if (/lightning|thunder/.test(e)) return 'cloudLightning';
  if (/rain|shower/.test(e)) return 'rain';
  if (/flood/.test(e)) return 'tank';
  if (/heat|temperature/.test(e)) return 'sun';
  if (/mist|fog/.test(e)) return 'cloud';
  return 'news';
}

/**
 * What to put on screen when the news request failed.
 *
 * Only a connection failure (status 0) carries a message worth showing — it tells the
 * farmer to check their signal. Anything else is a server message written for developers
 * ("Route /api/data/news?... not found"), so the translated line is used instead.
 */
export function newsErrorText(error, t) {
  if (error?.status === 0 && error.message) return error.message;
  return t('newsUnavailable');
}

// "Action Required:" / "Warning Description:" style labels the Met Department puts in front of a
// section: short, ending in a colon, no sentence before it
const LABEL = /^([^:.!?\n]{1,60}):\s*(.*)$/s;

/**
 * The CAP instruction as titled sections of bullet points, e.g.
 *   "Action Required: • Stay indoors • Unplug …\nDamage Expected: • Power cuts …"
 *   -> [{ title: 'Action Required', items: ['Stay indoors', 'Unplug …'] }, { title: 'Damage Expected', items: [...] }]
 * A line with no label gives a section with title null. Works the same for the Sinhala and Tamil texts.
 */
export function instructionSections(instruction) {
  if (!instruction) return [];
  const sections = [];
  let pending = null;   // a title on a line of its own ("Action Required:"), for the points on the lines after it
  for (const line of String(instruction).split('\n')) {
    const [head, ...bullets] = line.split(/(?:^|\s)[•·*]\s*/);
    const items = bullets.map((s) => s.replace(/^[-–—]\s*/, '').trim()).filter((s) => s.length > 2);
    let title = null;
    let lead = head.trim();
    const m = LABEL.exec(lead);
    if (m) { title = m[1].trim(); lead = m[2].trim(); }
    if (lead.length > 2) items.unshift(lead.replace(/^[-–—]\s*/, ''));
    if (!items.length) { if (title) pending = title; continue; }
    if (!title && pending) { title = pending; pending = null; }
    if (!title && sections.length) { sections[sections.length - 1].items.push(...items); continue; }   // more points
    sections.push({ title, items });
  }
  return sections;
}

/** Every point of the instruction in order, without the section titles (the first is used as an alert's text). */
export function instructionSteps(instruction) {
  return instructionSections(instruction).flatMap((s) => s.items);
}

// The Met Department's colour tiers as a plain risk level: "Thunderstorms Amber Warning (Be Prepared)"
// reads as "Thunderstorms - Medium risk". The server reads the colour off the headline (capParse.js colourOf,
// orange counted as amber).
const RISK_KEY = { yellow: 'riskLow', amber: 'riskMedium', red: 'riskHigh' };

/** The title to show for a warning: its event and risk level, or the feed's own headline when it names no colour. */
export function newsTitle(item, t) {
  const key = RISK_KEY[item?.colour];
  if (!key || !item.event) return item?.headline || item?.event || '';
  return `${item.event} - ${t(key)}`;
}

/** The warning's description without the "Warning Description:" label in front of it. */
export function bodyText(body) {
  const m = LABEL.exec(String(body || '').trim());
  return (m && m[2] ? m[2] : String(body || '')).trim();
}
