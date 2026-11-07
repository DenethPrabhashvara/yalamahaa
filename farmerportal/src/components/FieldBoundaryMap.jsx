import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from './Icon.jsx';
import { lockToSriLanka, makeBaseLayers, pinIcon } from './LeafletFarmMap.jsx';
import { MAP_CENTER, MAP_ZOOM } from '../data.js';
import { MAX_CORNERS, selfIntersects } from '../fieldShape.js';
import { COLORS } from '../theme.js';

const cornerIcon = (n) => L.divIcon({ className: 'lf-corner', html: `<span>${n}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });

const shapeStyle = (crossed) => ({
  color: crossed ? '#e5484d' : COLORS.accent,
  weight: 3,
  fillColor: crossed ? '#e5484d' : COLORS.accent,
  fillOpacity: 0.25,
});

/**
 * Satellite map for marking a field: tap each corner, drag a corner to move it.
 * Always the free Leaflet map (Esri imagery), whichever map the pin step used.
 * points: [{ lat, lng }]; onChange gets the new list. onFail() when it can't load (offline).
 */
export default function FieldBoundaryMap({ pin, points, onChange, onFail, t }) {
  const boxRef = useRef();
  const mapRef = useRef();
  const cornersRef = useRef();
  const shapeRef = useRef();
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const layersRef = useRef(null);
  if (!layersRef.current) layersRef.current = makeBaseLayers();
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState('satellite');
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { onFail(); return undefined; }
    const start = points.length ? points : pin?.lat != null ? [pin] : null;
    const map = L.map(boxRef.current, {
      center: start ? [start[0].lat, start[0].lng] : [MAP_CENTER.lat, MAP_CENTER.lng],
      zoom: start ? 18 : MAP_ZOOM,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'topright', zoomInTitle: t('a11yZoomIn'), zoomOutTitle: t('a11yZoomOut') }).addTo(map);
    lockToSriLanka(map);
    map.attributionControl.setPrefix(false);
    layersRef.current.satellite.forEach((l) => l.addTo(map));
    if (pin?.lat != null) L.marker([pin.lat, pin.lng], { icon: pinIcon, interactive: false, keyboard: false }).addTo(map);
    if (points.length >= 2) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 19 });

    shapeRef.current = L.polygon([], { ...shapeStyle(false), interactive: false }).addTo(map);
    cornersRef.current = L.layerGroup().addTo(map);
    map.on('click', (e) => {
      const cur = pointsRef.current;
      if (cur.length >= MAX_CORNERS) return;
      onChangeRef.current([...cur, { lat: e.latlng.lat, lng: e.latlng.lng }]);
    });

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
    setReady(true);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw the corners and the shape whenever the list changes
  useEffect(() => {
    const group = cornersRef.current;
    const shape = shapeRef.current;
    if (!group || !shape) return;
    const draw = (list) => {
      shape.setLatLngs(list.map((p) => [p.lat, p.lng]));
      shape.setStyle(shapeStyle(selfIntersects(list)));
    };
    group.clearLayers();
    draw(points);
    points.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], { icon: cornerIcon(i + 1), draggable: true, keyboard: false, title: `${t('corner')} ${i + 1}` });
      // the shape follows the finger while dragging; the list only changes when the corner is let go
      m.on('drag', () => { const ll = m.getLatLng(); draw(points.map((q, j) => (j === i ? { lat: ll.lat, lng: ll.lng } : q))); });
      m.on('dragend', () => { const ll = m.getLatLng(); onChangeRef.current(points.map((q, j) => (j === i ? { lat: ll.lat, lng: ll.lng } : q))); });
      group.addLayer(m);
    });
  }, [points, ready, t]);

  const switchBase = (next) => {
    const map = mapRef.current;
    if (!map || next === base) return;
    layersRef.current[base].forEach((l) => map.removeLayer(l));
    layersRef.current[next].forEach((l) => l.addTo(map));
    setBase(next);
  };

  // for a farmer standing at a corner of the field
  const cornerHere = () => {
    if (!window.isSecureContext) { setGpsError(t('needHttps')); return; }
    if (!navigator.geolocation) { setGpsError(t('gpsUnavailable')); return; }
    if (pointsRef.current.length >= MAX_CORNERS) return;
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChangeRef.current([...pointsRef.current, p]);
        mapRef.current?.panTo([p.lat, p.lng]);
      },
      (err) => { setLocating(false); setGpsError(err.code === 1 ? t('gpsDenied') : t('gpsUnavailable')); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return (
    <>
      <div className="gmap-wrap tall">
        <div ref={boxRef} className="gmap" role="application" aria-label={t('fieldTitle')} />
        <div className="seg-mini map-base" role="radiogroup" aria-label={t('a11yMapType')}>
          <button type="button" role="radio" aria-checked={base === 'satellite'} className={base === 'satellite' ? 'on' : ''} onClick={() => switchBase('satellite')}>{t('mapSatellite')}</button>
          <button type="button" role="radio" aria-checked={base === 'map'} className={base === 'map' ? 'on' : ''} onClick={() => switchBase('map')}>{t('mapStreet')}</button>
        </div>
        {ready && points.length === 0 && <div className="tap-hint"><Icon name="target" size={16} />{t('tapCorners')}</div>}
        <div className="corner-tools">
          <button type="button" className="corner-tool" onClick={() => onChange(points.slice(0, -1))} disabled={!points.length} aria-label={t('undoCorner')} title={t('undoCorner')}>
            <Icon name="undo" size={20} stroke={2.4} />
          </button>
          <button type="button" className="corner-tool" onClick={() => onChange([])} disabled={!points.length} aria-label={t('clearCorners')} title={t('clearCorners')}>
            <Icon name="trash" size={18} stroke={2.2} />
          </button>
        </div>
        <button type="button" className="gps-btn" onClick={cornerHere} disabled={locating || !ready}>
          <Icon name="walk" size={18} stroke={2.4} />{locating ? t('locating') : t('cornerHere')}
        </button>
      </div>
      {gpsError && <div className="note-box amber"><Icon name="info" size={18} stroke={2.2} style={{ flex: 'none' }} />{gpsError}</div>}
    </>
  );
}
