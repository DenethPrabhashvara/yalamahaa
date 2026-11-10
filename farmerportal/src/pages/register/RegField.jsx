import { lazy, Suspense, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppContext.jsx';
import { PrimaryBtn, StepHeader } from '../../components/UI.jsx';
import Icon from '../../components/Icon.jsx';
import { areaAcres, boundaryState, MIN_CORNERS, roundAcres } from '../../fieldShape.js';

// Leaflet only downloads when this step opens.
const FieldBoundaryMap = lazy(() => import('../../components/FieldBoundaryMap.jsx'));

// Drawn area and the farmer's total this far apart get a gentle "check the corners" note.
const MISMATCH = 0.5;

// Step 2c: the field's corners on the map (optional) and the total land area (required).
// The flood model uses the shape, or a circle of the total area around the pin when there's no shape.
export default function RegField() {
  const { t, draft, update } = useApp();
  const navigate = useNavigate();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  if (draft.pin?.lat == null) return <Navigate to="/register/pin" replace />;

  const points = draft.boundary || [];
  const set = (patch) => update((s) => ({ draft: { ...s.draft, ...patch } }));
  const state = boundaryState(points);
  const drawn = state === 'ok' ? roundAcres(areaAcres(points)) : null;
  const cropTotal = roundAcres(draft.crops.reduce((s, c) => s + (Number(c.acres) || 0), 0));

  // Until the farmer types a number, the total follows the drawn area (or the crops' total).
  // Only their own typing counts: Continue saves the box's value, which may be the crops' total,
  // and that must not later be shown back to them as a number they "entered".
  const typed = Boolean(draft.totalTyped) && draft.totalAcres != null && draft.totalAcres !== '';
  const total = typed ? draft.totalAcres : String(drawn ?? cropTotal);
  const totalNum = Number(total);
  const setTotal = (v) => set({ totalAcres: v, totalTyped: true });
  // Moving, adding or removing a corner puts the total back on the marked area, even if the farmer
  // typed one earlier. While the shape isn't complete (under 3 corners, crossing edges) the box keeps
  // whatever it showed; once it is a field again it follows the new area. Typing after that still wins.
  const changeCorners = (next) => set(boundaryState(next) === 'ok'
    ? { boundary: next, totalAcres: String(roundAcres(areaAcres(next))), totalTyped: false }
    : { boundary: next, totalAcres: total, totalTyped: true });
  const step = (d) => setTotal(String(Math.max(0.25, Math.round(((Number(total) || 0) + d) * 4) / 4)));
  const mismatch = drawn != null && totalNum > 0 && Math.abs(drawn - totalNum) > MISMATCH * Math.max(drawn, totalNum) && Math.abs(drawn - totalNum) > 0.5;

  const canNext = (state === 'none' || state === 'ok') && totalNum > 0;
  const next = () => {
    set({ totalAcres: String(roundAcres(totalNum)) });
    navigate('/register/water');
  };

  return (
    <div className="screen">
      <StepHeader step={2} backTo="/register/pin" />
      <div>
        <div className="eyebrow">{t('step')} 2c - {t('fieldStep')}</div>
        <h1 className="h1 sm">{t('fieldTitle')}</h1>
      </div>

      <div className="note-box accent"><Icon name="shape" size={18} stroke={2.2} style={{ flex: 'none' }} />{t('fieldHelp')}</div>

      {offline ? (
        <div className="card center offline-map">
          <span className="icon-tile amber big"><Icon name="wifiOff" size={30} /></span>
          <div className="f16 fw600 lh">{t('fieldOffline')}</div>
          <button type="button" className="pill-btn outline" onClick={() => setOffline(navigator.onLine === false)}>
            <Icon name="refresh" size={16} />{t('tryAgain')}
          </button>
        </div>
      ) : (
        <Suspense fallback={<div className="gmap-wrap tall"><div className="gmap-loading"><Icon name="map" size={20} />{t('loadingMap')}</div></div>}>
          <FieldBoundaryMap pin={draft.pin} points={points} onChange={changeCorners} onFail={() => setOffline(true)} t={t} />
        </Suspense>
      )}

      {state === 'ok' && (
        <div className="dist-chip static">{t('fieldMarked')}: {drawn} {t('acres')} - {points.length} {t('corners')}</div>
      )}
      {state === 'few' && <div className="f13 muted">{t('needCorners').replace('{n}', MIN_CORNERS)}</div>}
      {state === 'crossed' && <div className="err-text" role="alert">{t('cornersCross')}</div>}

      <div className="field">
        <span className="label">{t('totalLand')}</span>
        <div className="row gap10">
          <button type="button" className="round-step soft" aria-label={t('a11yLess')} onClick={() => step(-0.25)}>−</button>
          <div className="acre-box">
            <input aria-label={t('totalLand')} inputMode="decimal" value={total}
              onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, '').slice(0, 7))} />
            <span>{t('acres')}</span>
          </div>
          <button type="button" className="round-step dark" aria-label={t('a11yMore')} onClick={() => step(0.25)}>+</button>
        </div>
        <div className="f13 muted lh">{t('totalLandHint')}</div>
      </div>

      {mismatch && (
        <div className="note-box amber"><Icon name="info" size={18} stroke={2.2} style={{ flex: 'none' }} />
          <div className="col gap8">
            <span>{t('areaMismatch').replace('{drawn}', drawn).replace('{total}', roundAcres(totalNum))}</span>
            <button type="button" className="pill-btn outline sm self-start" onClick={() => setTotal(String(drawn))}>
              {t('useMarkedArea').replace('{drawn}', drawn)}
            </button>
          </div>
        </div>
      )}

      <div className="grow" />
      <PrimaryBtn onClick={next} disabled={!canNext}>{state === 'none' ? t('skipMarking') : t('continue')}</PrimaryBtn>
    </div>
  );
}
