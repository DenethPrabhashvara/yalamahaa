// Alerts built from live data (useFarmConditions) plus the app's own notes (e.g. farm registered).
// Ids include the reading/date, so a new reading makes a new unread alert. Read ids are kept in app state.
import { useMemo } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { fmtDay } from '../components/ForecastChart.jsx';
import { LOW_PCT } from './reservoirs.js';
import { useNews, activeNews, instructionSteps, bodyText } from './news.js';
import { hhmm, timeAgo } from '../time.js';

const DATE = { day: 'numeric', month: 'short' };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// The app's own notes. "Farm registered" notes carry farmId/acres/at and are written here, in the
// farmer's current language; older ones were saved with English title/body and are shown as they are.
export function noteText(n, t, lang) {
  if (n.kind !== 'farm' || !n.farmId) return n;
  return {
    ...n,
    title: `${t('farmRegisteredNote')} - ${n.farmId}`,
    body: n.acres ? `${n.acres} ${t('acres')}` : '',
    when: Number.isFinite(n.at) ? timeAgo(new Date(n.at).toISOString(), t, lang) : '',
  };
}

export function useAlerts(live) {
  const { t, lang, farm, alerts: notes, readAlerts, readNews } = useApp();
  const { flood, own, tank, readings, issue, issueStatus, today } = live;
  const latest = readings.data?.latest;
  // Same arguments as every other caller, so this shares their cached request.
  const news = useNews(lang, farm?.district);
  const advisories = news.data;

  return useMemo(() => {
    const list = [];
    if (flood?.level > 0) {
      list.push({
        id: `flood:${flood.name}:${flood.level}:${flood.at?.slice(0, 10)}`,
        kind: 'flood',
        title: `${t('floodWatch')} - ${flood.river}`,
        body: `${t(`floodLevel${flood.level}`)}. ${flood.name}: ${flood.gaugeLevel} m${flood.trend ? `, ${t(flood.trend)}` : ''}.`,
        when: hhmm(flood.at),
      });
    }
    // only the farm's own tank, not a nearby one
    if (own && tank?.id === own.id && latest) {
      const when = fmtDay(latest.date, lang, DATE);
      if (latest.spilling) {
        list.push({ id: `spill:${own.id}:${latest.date}`, kind: 'tank', title: `${own.name} - ${t('spilling')}`, body: `${t('pctFull').replace('{p}', Math.round(latest.percent))}${latest.spillRate != null ? ` - ${latest.spillRate} cusec` : ''}.`, when });
      } else if (latest.percent < LOW_PCT) {
        list.push({ id: `low:${own.id}:${latest.date}`, kind: 'tank', title: `${own.name} - ${t('tankLow')}`, body: `${t('pctFull').replace('{p}', Math.round(latest.percent))}. ${t('adviceLow')}`, when });
      }
    }
    if (issue) {
      const range = `${fmtDay(issue.start, lang, DATE)} – ${fmtDay(issue.end, lang, DATE)}`;
      if (issueStatus === 'scheduled' && daysBetween(today, issue.start) <= 7) {
        list.push({ id: `issue:${issue.id}:soon`, kind: 'release', title: `${t('issueStarts')} ${fmtDay(issue.start, lang, DATE)}`, body: `${issue.name} - ${range}`, when: fmtDay(today, lang, DATE) });
      } else if (issueStatus === 'flowing' && daysBetween(issue.start, today) <= 3) {
        list.push({ id: `issue:${issue.id}:on`, kind: 'release', title: `${t('flowing')} - ${issue.name}`, body: `${t('issueUntil')} ${fmtDay(issue.end, lang, DATE)}`, when: fmtDay(issue.start, lang, DATE) });
      }
    }
    // Only the warnings that earn the home banner reach the bell. Routine advisories
    // (amber lightning turns up constantly) stay on the news page, because a badge that
    // is always lit is a badge farmers stop reading.
    const readAdvisories = new Set(readNews || []);
    const capAlerts = activeNews(advisories)
      .filter((n) => n.banner || n.tone === 'red')
      .map((n) => ({
        id: `cap:${n.id}`,
        kind: 'advisory',
        title: n.headline,
        body: instructionSteps(n.instruction)[0] || bodyText(n.body),
        when: hhmm(n.sent),
        read: readAdvisories.has(`cap:${n.id}`),
      }));

    const read = new Set(readAlerts);
    const appNotes = notes.map((n) => noteText(n, t, lang));
    return [...capAlerts, ...list.map((a) => ({ ...a, read: read.has(a.id) })), ...appNotes];
  }, [flood, own, tank, latest, issue, issueStatus, today, notes, readAlerts, readNews, advisories, t, lang]);
}
