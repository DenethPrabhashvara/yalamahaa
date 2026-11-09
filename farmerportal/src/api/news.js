// Official weather warnings from the Department of Meteorology, served by our API
// (GET /api/data/news). The feed itself sends no CORS headers, so it can only ever be
// read through the API and never fetched from the browser directly.
//
// IMPORTANT: every caller must use `useNews(lang, farm?.district)` with exactly those
// arguments. useApiData keys its cache on the string, and /api/data sits behind a
// 53-request-per-5-minutes limiter, so identical keys are what make the home banner, the
// home card, the alerts list and the news page share ONE request instead of four.
import { request } from './auth.js';
import { useApiData } from './reservoirs.js';
import { isExpired } from './newsRules.js';

// The pure rules live in newsRules.js so they can be tested without Vite; re-exported
// here so callers only need one import.
export { isExpired, activeNews, bannerNews, newsIcon, instructionSections, instructionSteps, bodyText, newsErrorText, newsTitle } from './newsRules.js';

const q = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
  const str = s.toString();
  return str ? `?${str}` : '';
};

export function fetchNews(lang, district, all) {
  return request(`/api/data/news${q({ lang, district, all: all ? '1' : null })}`)
    .then((res) => (res.data || []).map((n) => ({ ...n, expired: isExpired(n) })))
    .catch((err) => {
      // An API that predates this feature has no /news route. That is a deployment state,
      // not something to show a farmer an error about: treat it as "no warnings" and say
      // so where only a developer will look.
      if (err?.status === 404) {
        console.warn('/api/data/news is missing: the API has not been updated yet.');
        return [];
      }
      throw err;
    });
}

export function useNews(lang, district, all) {
  const key = `news:${lang || 'en'}:${all ? 'all' : district || ''}`;
  return useApiData(key, () => fetchNews(lang, district, all));
}
