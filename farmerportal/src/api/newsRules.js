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

/** The CAP instruction is already a bulleted list of what to do; split it into steps. */
export function instructionSteps(instruction) {
  if (!instruction) return [];
  return instruction
    .split(/\n|(?:^|\s)[•·*]\s*/)
    .map((s) => s.replace(/^[-–—]\s*/, '').trim())
    .filter((s) => s.length > 2);
}
