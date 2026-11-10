import { useState } from 'react';
import Sheet from '../components/Sheet.jsx';

// The irrigation map draws only the tanks we have water level data for (irrigationLayers.js,
// options.dataTanks). This button shows the rest after the farmer reads why they have no levels.
// layers: a ref to the object addIrrigationLayers returned. body: the sheet's message for this screen.
export default function AllReservoirsButton({ layers, body, t, className = '' }) {
  const [showAll, setShowAll] = useState(false);
  const [asking, setAsking] = useState(false);
  const set = (value) => {
    setShowAll(value);
    setAsking(false);
    layers.current?.setShowAll(value);
  };
  return (
    <>
      <button type="button" className={`map-all-chip ${className}${showAll ? ' on' : ''}`} aria-pressed={showAll}
        onClick={() => (showAll ? set(false) : setAsking(true))}>
        {showAll ? <>{t('mapAllShown')} - <u>{t('mapHide')}</u></> : t('mapShowAll')}
      </button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={t('mapAllTitle')}>
        <p className="f15" style={{ margin: 0 }}>{body}</p>
        <div className="row gap10">
          <button type="button" className="pill-btn outline" style={{ flex: 1 }} onClick={() => setAsking(false)}>{t('mapCancel')}</button>
          <button type="button" className="pill-btn dark" style={{ flex: 1 }} onClick={() => set(true)}>{t('continue')}</button>
        </div>
      </Sheet>
    </>
  );
}
