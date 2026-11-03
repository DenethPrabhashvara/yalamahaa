import { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { IconBtn } from '../components/UI.jsx';
import Icon from '../components/Icon.jsx';
import Sheet from '../components/Sheet.jsx';
import { useNews, newsIcon, instructionSteps, newsErrorText } from '../api/news.js';
import { timeAgo, fmtDateTime } from '../time.js';

// Official weather warnings from the Department of Meteorology. "My area" filters to the
// farm's district plus island-wide notices; "All Sri Lanka" shows everything, because a
// cyclone one district away still matters.
export default function News() {
  const { t, lang, farm, readNews, update } = useApp();
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useNews(lang, farm?.district, !mine);
  const items = data || [];
  const read = new Set(readNews || []);

  const show = (item) => {
    setOpen(item);
    if (read.has(item.id)) return;
    update((st) => ({ readNews: [...new Set([...(st.readNews || []), item.id])].slice(-100) }));
  };

  return (
    <div className="screen">
      <div className="row gap10">
        <IconBtn icon="back" label={t('back')} to="/home" />
        <div className="grow" />
        <button type="button" className={`chip-white btn ${loading ? 'spinning' : ''}`} onClick={reload} aria-label={t('tryAgain')}>
          <Icon name="refresh" size={14} stroke={2.4} />
        </button>
      </div>
      <h1 className="h1">{t('news')}</h1>

      {farm?.district && (
        <div className="seg seg-soft seg-2" role="tablist">
          <button type="button" role="tab" aria-selected={mine} className={mine ? 'on' : ''} onClick={() => setMine(true)}>{t('newsMine')}</button>
          <button type="button" role="tab" aria-selected={!mine} className={!mine ? 'on' : ''} onClick={() => setMine(false)}>{t('newsAll')}</button>
        </div>
      )}

      {loading && !items.length && (
        <div className="card center" style={{ minHeight: 160 }}>
          <Icon name="refresh" size={24} className="spin" />
          <div className="f15 muted">{t('loadingNews')}</div>
        </div>
      )}

      {error && !items.length && (
        <div className="card center" style={{ minHeight: 160 }}>
          <Icon name="info" size={24} />
          <div className="f15 muted lh" style={{ textAlign: 'center' }}>{newsErrorText(error, t)}</div>
          <button type="button" className="pill-btn outline sm" onClick={reload}>{t('tryAgain')}</button>
        </div>
      )}

      {!loading && !error && !items.length && (
        <div className="empty">
          <div className="icon-tile soft big"><Icon name="news" size={30} /></div>
          <div className="f16 fw600">{t('noNews')}</div>
        </div>
      )}

      <div className="col gap10">
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`alert-row ${n.expired ? 'ended' : ''} ${read.has(n.id) || n.expired ? '' : 'unread'}`}
            onClick={() => show(n)}
          >
            <div className={`icon-tile ${n.tone}`}><Icon name={newsIcon(n)} size={22} /></div>
            <div className="grow" style={{ textAlign: 'left' }}>
              <div className="row between gap8">
                <span className="f15 fw600">{n.headline}</span>
                <span className="f12 muted nowrap">{n.expired ? t('ended') : timeAgo(n.sent, t, lang)}</span>
              </div>
              {n.body && <div className="f15 muted lh" style={{ marginTop: 2 }}>{n.body}</div>}
              <div className="f12 muted" style={{ marginTop: 4 }}>{areaLine(n, t)}</div>
            </div>
            {!read.has(n.id) && !n.expired && <span className="unread-dot" aria-label="Unread" />}
          </button>
        ))}
      </div>

      {items.length > 0 && <div className="f12 muted" style={{ textAlign: 'center' }}>{t('newsSource')}</div>}

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.event || t('news')}>
        {open && (
          <>
            <div className="f17 fw600 lh">{open.headline}</div>
            {open.langFallback && <div className="f12 muted">{t('englishOnly')}</div>}
            <div className="f15 muted lh">
              {t('issued')} {fmtDateTime(open.sent, lang)}
              {open.expires ? ` - ${t('validUntil')} ${fmtDateTime(open.expires, lang)}` : ''}
            </div>
            {open.body && <div className="f15 lh">{open.body}</div>}

            {instructionSteps(open.instruction).length > 0 && (
              <>
                <div className="f15 fw600">{t('whatToDo')}</div>
                <ol className="steps light">
                  {instructionSteps(open.instruction).map((step, i) => (
                    <li key={step}><span className="num-badge">{i + 1}</span>{step}</li>
                  ))}
                </ol>
              </>
            )}

            <div className="f15 fw600">{t('affectedAreas')}</div>
            <div className="f15 muted lh">{areaDetail(open, t, farm)}</div>

            {open.web && (
              <a className="pill-btn outline sm" href={open.web} target="_blank" rel="noreferrer noopener">
                {t('openOfficial')} <Icon name="external" size={16} stroke={2.2} />
              </a>
            )}
            <div className="f12 muted">{t('newsSource')}</div>
          </>
        )}
      </Sheet>
    </div>
  );
}

// One short line for the list row: the farmer's own district when it is named, else a count.
function areaLine(n, t) {
  const d = n.areas?.districts || [];
  if (n.areas?.allIsland || !d.length) return t('allIsland');
  return d.slice(0, 3).join(', ') + (d.length > 3 ? ` +${d.length - 3}` : '');
}

function areaDetail(n, t, farm) {
  if (n.areas?.allIsland || !n.areas?.districts?.length) return t('allIsland');
  const d = n.areas.districts;
  const own = farm?.district && d.includes(farm.district) ? `${t('yourArea')}: ${farm.district}. ` : '';
  return own + d.join(', ');
}
