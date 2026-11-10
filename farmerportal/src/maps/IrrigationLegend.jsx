import { useEffect, useRef, useState } from 'react';

// Legend and load status for the irrigation layers (irrigationLayers.js).
// collapsible: starts as a small "Map legend" button so it doesn't cover the map; tap to open;
// the status line (loading, unavailable, zoom in) still shows while it is closed.
// selectedLabel / selectedAreaLabel: what the pulsing blue highlight means on this map, for the tank
// and for the fields its canals water (default "Your tank" / "Fields watered by your tank").
// showSelected: false when nothing is highlighted (a canal or river farmer, or no pin yet), so the
// "Your tank" rows don't point at something that isn't on the map.
export default function IrrigationLegend({ t, status, collapsible = false, selectedLabel, selectedAreaLabel, showSelected = true }) {
  const [open, setOpen] = useState(!collapsible);
  const boxRef = useRef(null);

  // a tap anywhere outside the open legend closes it (and still reaches the map / button it was on)
  useEffect(() => {
    if (!collapsible || !open) return undefined;
    const outside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [collapsible, open]);
  const message = status.error
    ? t('mapLayersFallback')
    : status.loading
      ? t('mapLayersLoading')
      : status.zoomedOut ? t('mapLayersZoomIn') : '';

  return (
    <div ref={boxRef} className={`irrigation-map-legend${collapsible ? ' collapsible' : ''}${open ? '' : ' closed'}`} aria-label={t('mapLegend')}>
      {collapsible && (
        <button type="button" className="legend-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {t('mapLegend')} {open ? '▾' : '▸'}
        </button>
      )}
      {open && (
        <>
          <div><i className="legend-reservoir" />{t('mapReservoir')}</div>
          {showSelected && <div><i className="legend-highlight" />{selectedLabel || t('mapSelectedTank')}</div>}
          {showSelected && <div className="legend-wide"><i className="legend-highlight-area" />{selectedAreaLabel || t('mapSelectedTankFields')}</div>}
          <div><i className="legend-bund" />{t('mapBund')}</div>
          <div><i className="legend-canal" />{t('mapCanal')}</div>
          <div><i className="legend-area" />{t('mapIrrigableArea')}</div>
        </>
      )}
      <div className="irrigation-map-status" aria-live="polite">{message}</div>
    </div>
  );
}
