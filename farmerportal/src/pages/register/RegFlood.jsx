import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppContext.jsx';
import { PrimaryBtn, StepHeader } from '../../components/UI.jsx';
import Icon from '../../components/Icon.jsx';

// Same values as farms.flood_history / flood_depth in the database.
export const FLOOD_HISTORY = [
  { id: 'never', key: 'floodNever' },
  { id: 'once', key: 'floodOnce' },
  { id: 'several', key: 'floodSeveral' },
  { id: 'unsure', key: 'floodUnsure' },
];
export const FLOOD_DEPTHS = [
  { id: 'ankle', key: 'depthAnkle' },
  { id: 'knee', key: 'depthKnee' },
  { id: 'waist', key: 'depthWaist' },
];
export const flooded = (flood) => flood?.history === 'once' || flood?.history === 'several';

// "Flooded several times - knee deep - last in 2025" for the review and farm pages
export function floodLabel(flood, t) {
  if (!flood?.history) return null;
  const h = FLOOD_HISTORY.find((x) => x.id === flood.history);
  const d = FLOOD_DEPTHS.find((x) => x.id === flood.depth);
  return [t(h.key), flooded(flood) && d && t(d.key), flooded(flood) && flood.lastYear && `${t('lastFlood')} ${flood.lastYear}`]
    .filter(Boolean).join(' - ');
}

// Step 2e (optional): has this field flooded in the last 5 years? The answers check
// the flood model's height-above-river numbers against what really happened.
export default function RegFlood() {
  const { t, draft, update } = useApp();
  const navigate = useNavigate();
  const flood = draft.flood || {};
  const set = (patch) => update((s) => ({ draft: { ...s.draft, flood: { ...(s.draft.flood || {}), ...patch } } }));
  const year = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => year - i);

  const pickHistory = (history) => set(flooded({ history }) ? { history } : { history, depth: null, lastYear: null });
  const skip = () => { update((s) => ({ draft: { ...s.draft, flood: null } })); navigate('/register/review'); };

  return (
    <div className="screen">
      <StepHeader step={2.5} backTo="/register/water" />
      <div>
        <div className="eyebrow">{t('step')} 2e - {t('floodStep')} ({t('optional')})</div>
        <h1 className="h1 sm">{t('floodTitle')}</h1>
      </div>

      <div className="note-box accent"><Icon name="info" size={18} stroke={2.2} style={{ flex: 'none' }} />{t('floodHelp')}</div>

      <div className="col gap8" role="radiogroup" aria-label={t('floodTitle')}>
        {FLOOD_HISTORY.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={flood.history === o.id}
            className={`option-row ${flood.history === o.id ? 'on' : ''}`} onClick={() => pickHistory(o.id)}>
            <span className="grow">{t(o.key)}</span>
            {flood.history === o.id && <Icon name="check" size={20} stroke={2.6} />}
          </button>
        ))}
      </div>

      {flooded(flood) && (
        <>
          <div className="field">
            <span className="label">{t('floodDepthQ')}</span>
            <div className="col gap8" role="radiogroup" aria-label={t('floodDepthQ')}>
              {FLOOD_DEPTHS.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={flood.depth === o.id}
                  className={`option-row ${flood.depth === o.id ? 'on' : ''}`} onClick={() => set({ depth: o.id })}>
                  <span className="grow">{t(o.key)}</span>
                  {flood.depth === o.id && <Icon name="check" size={20} stroke={2.6} />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">{t('floodYearQ')}</span>
            <div className="pill-group" role="radiogroup" aria-label={t('floodYearQ')}>
              {years.map((y) => (
                <button key={y} type="button" role="radio" aria-checked={flood.lastYear === y}
                  className={`pill ${flood.lastYear === y ? 'on' : ''}`} onClick={() => set({ lastYear: flood.lastYear === y ? null : y })}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="grow" />
      <PrimaryBtn onClick={() => navigate('/register/review')} disabled={!flood.history}>{t('continue')}</PrimaryBtn>
      <button type="button" className="pill-btn outline" onClick={skip}>{t('skip')}</button>
    </div>
  );
}
