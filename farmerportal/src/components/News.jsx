import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import Icon from './Icon.jsx';
import { Card } from './UI.jsx';
import { useNews, activeNews, bannerNews, newsIcon, newsErrorText } from '../api/news.js';
import { timeAgo, fmtDateTime } from '../time.js';

// Both of these call useNews with the same arguments on purpose: useApiData caches on the
// key, so the banner, this card, the news page and the alerts list share one request.

/**
 * The red strip pinned above everything on Home while a cyclone or a red-level warning is
 * in force for the farmer's district. Renders nothing the rest of the time, which is most
 * of the time.
 */
export function CycloneBanner() {
  const { t, lang, farm } = useApp();
  const { data } = useNews(lang, farm?.district);
  const item = bannerNews(data);
  if (!item) return null;
  return (
    <Link to="/news" className="alert-banner" role="alert">
      <Icon name={newsIcon(item)} size={24} stroke={2.2} />
      <div className="ab-text grow">
        <div className="ab-head">{item.headline}</div>
        {item.expires && <div className="ab-sub">{t('validUntil')} {fmtDateTime(item.expires, lang)}</div>}
      </div>
      <Icon name="chevron" size={18} stroke={2.4} />
    </Link>
  );
}

/** "Latest news" on Home: the newest couple of live warnings, tapping through to /news. */
export function LatestNewsCard() {
  const { t, lang, farm } = useApp();
  const { data, loading, error, reload } = useNews(lang, farm?.district);
  const items = activeNews(data).slice(0, 2);

  return (
    <Card>
      <div className="row between gap8">
        <h2 className="h2">{t('latestNews')}</h2>
        <Link to="/news" className="f15 fw600 ink">{t('seeAllNews')}</Link>
      </div>

      {loading && !items.length && <div className="f15 muted">{t('loadingNews')}</div>}

      {error && !items.length && (
        <div className="row between gap8 f15">
          <span className="muted">{newsErrorText(error, t)}</span>
          <button type="button" className="link-btn" onClick={reload}>{t('tryAgain')}</button>
        </div>
      )}

      {/* Kept visible rather than hidden, so Home's layout doesn't jump about. */}
      {!loading && !error && !items.length && <div className="f15 muted">{t('noNewsNow')}</div>}

      {items.map((n) => (
        <Link key={n.id} to="/news" className="row gap10 news-mini">
          <div className={`icon-tile sm-tile ${n.tone}`}><Icon name={newsIcon(n)} size={18} /></div>
          <div className="grow min0">
            <div className="f15 fw600">{n.headline}</div>
            <div className="f13 muted">{timeAgo(n.sent, t, lang)}</div>
          </div>
        </Link>
      ))}
    </Card>
  );
}
