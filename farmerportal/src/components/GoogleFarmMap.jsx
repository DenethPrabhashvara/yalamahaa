import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { GOOGLE_MAP_ID, haversine, loadGoogleMaps } from '../api/googleMaps.js';
import { MAP_CENTER, MAP_ZOOM, SRI_LANKA_BOUNDS, TANK_LABEL_MIN_ZOOM } from '../data.js';
import { RESERVOIRS } from '../reservoirs.js';
import { COLORS } from '../theme.js';

// Every irrigation tank/reservoir in reservoirs.js, for map labels and "nearest tank".
export const MAPPED_TANKS = RESERVOIRS.map((tk) => ({ ...tk, pos: { lat: tk.lat, lng: tk.lon } }));

export function nearestTank(pin) {
  let best = null;
  MAPPED_TANKS.forEach((tk) => {
    const d = haversine(pin, tk.pos);
    if (!best || d < best.d) best = { d, tank: tk };
  });
  return best && { name: best.tank.name, meters: Math.round(best.d / 10) * 10 };
}

export function formatDistance(m) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

// The farm's place line is saved (and sent to the API as location_label) in English, e.g.
// "1.2 km from Kaudulla", so office staff can read it. On screen it is put back in the farmer's
// language; anything else (a district name, coordinates) is shown as it is.
export function placeLabel(nearest, t) {
  const m = /^([\d.]+ k?m) from (.+)$/.exec(nearest || '');
  return m ? t('distanceFrom').replace('{d}', m[1]).replace('{name}', m[2]) : nearest || '';
}

// Farm pin artwork, shared with the free Leaflet map.
export const PIN_SVG = `<svg width="40" height="52" viewBox="0 0 40 52"><ellipse cx="20" cy="50" rx="9" ry="3" fill="rgba(0,0,0,.25)"/><path d="M20 48S4 30 4 18a16 16 0 0 1 32 0c0 12-16 30-16 30Z" fill="${COLORS.pin}" stroke="#fff" stroke-width="2"/><circle cx="20" cy="18" r="6.5" fill="#fff"/></svg>`;

function pinEl() {
  const el = document.createElement('div');
  el.className = 'gm-farm-pin';
  el.innerHTML = PIN_SVG;
  return el;
}

function tankEl(name) {
  const el = document.createElement('div');
  el.className = 'gm-tank-label';
  el.textContent = name;
  return el;
}

/**
 * Satellite map: tap or drag the pin onto the field, or use the phone's GPS.
 * Calls onFail() if Google Maps can't load so the parent can show the offline map.
 */
export default function GoogleFarmMap({ pin, onPin, onLocate, onFail, autoLocate = false, t }) {
  const boxRef = useRef();
  const mapRef = useRef();
  const markerRef = useRef();
  const onPinRef = useRef(onPin);
  const placedByHand = useRef(false);
  onPinRef.current = onPin;
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [q, setQ] = useState('');
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fail = () => { if (!cancelled) onFail(); };
    window.addEventListener('gmaps-auth-failure', fail);
    (async () => {
      try {
        const maps = await loadGoogleMaps();
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')]);
        if (cancelled) return;
        const map = new Map(boxRef.current, {
          center: pin?.lat != null ? { lat: pin.lat, lng: pin.lng } : MAP_CENTER,
          zoom: pin?.lat != null ? 17 : MAP_ZOOM,
          mapId: GOOGLE_MAP_ID,
          mapTypeId: 'hybrid',
          // rural imagery runs out past this and Google shows "Sorry, we have no imagery here"
          maxZoom: 19,
          // Sri Lanka only: no panning or zooming out past the island
          restriction: { latLngBounds: SRI_LANKA_BOUNDS, strictBounds: true },
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
        mapRef.current = map;
        const tankMarkers = MAPPED_TANKS.map((tk) => new AdvancedMarkerElement({ map, position: tk.pos, content: tankEl(tk.name), title: tk.name }));
        // zoomed out to the whole island the 117 names pile up: show them from TANK_LABEL_MIN_ZOOM in
        let shown = true;
        const showTanks = () => {
          const want = map.getZoom() >= TANK_LABEL_MIN_ZOOM;
          if (want !== shown) { shown = want; tankMarkers.forEach((m) => { m.map = want ? map : null; }); }
        };
        map.addListener('zoom_changed', showTanks);
        showTanks();
        const marker = new AdvancedMarkerElement({ map, content: pinEl(), gmpDraggable: true, title: t('myPlot') });
        if (pin?.lat != null) marker.position = { lat: pin.lat, lng: pin.lng };
        marker.addListener('dragend', () => {
          placedByHand.current = true;
          const p = marker.position;
          onPinRef.current({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng });
        });
        map.addListener('click', (e) => { placedByHand.current = true; onPinRef.current({ lat: e.latLng.lat(), lng: e.latLng.lng() }); });
        markerRef.current = marker;
        setReady(true);
      } catch {
        fail();
      }
    })();
    return () => { cancelled = true; window.removeEventListener('gmaps-auth-failure', fail); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the marker in step with the saved pin
  useEffect(() => {
    if (markerRef.current) markerRef.current.position = pin?.lat != null ? { lat: pin.lat, lng: pin.lng } : null;
  }, [pin, ready]);

  // auto: the request made when the map opens. If the farmer taps their field before it answers,
  // their pin wins; pressing "Use my location" still moves it.
  const useGps = (auto = false) => {
    // Browsers only allow location on https:// (or localhost).
    if (!window.isSecureContext) { setGpsError(t('needHttps')); return; }
    if (!navigator.geolocation) { setGpsError(t('gpsUnavailable')); return; }
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        if (auto && placedByHand.current) return;
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
        onPinRef.current(p);
        onLocate?.(p);
        mapRef.current?.panTo(p);
        mapRef.current?.setZoom(17);
      },
      (err) => { setLocating(false); if (!(auto && placedByHand.current)) setGpsError(err.code === 1 ? t('gpsDenied') : t('gpsUnavailable')); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  // Ask for location as soon as the map is up (this is what shows the browser's permission prompt).
  useEffect(() => {
    if (ready && autoLocate) useGps(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim() || !ready) return;
    setSearchError('');
    try {
      const { Geocoder } = await window.google.maps.importLibrary('geocoding');
      const { results } = await new Geocoder().geocode({ address: q, region: 'lk', componentRestrictions: { country: 'LK' } });
      const loc = results[0].geometry.location;
      mapRef.current.panTo(loc);
      mapRef.current.setZoom(16);
    } catch {
      setSearchError(t('placeNotFound'));
    }
  };

  return (
    <>
      <form className="search" onSubmit={search}>
        <Icon name="search" size={20} />
        <input aria-label={t('searchVillage')} placeholder={t('searchVillage')} value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
        {q && <button type="button" className="icon-btn soft sm" aria-label={t('a11yClear')} onClick={() => { setQ(''); setSearchError(''); }}><Icon name="close" size={14} /></button>}
      </form>
      {searchError && <div className="f13 err-text">{searchError}</div>}

      <div className="gmap-wrap">
        <div ref={boxRef} className="gmap" role="application" aria-label={t('pinTitle')} />
        {!ready && <div className="gmap-loading"><Icon name="map" size={20} />{t('loadingMap')}</div>}
        {ready && !pin?.lat && <div className="tap-hint"><Icon name="target" size={16} />{t('tapField')}</div>}
        <button type="button" className="gps-btn" onClick={() => useGps()} disabled={locating || !ready}>
          <Icon name="target" size={18} stroke={2.4} />{locating ? t('locating') : t('useMyLocation')}
        </button>
      </div>
      {gpsError && <div className="note-box amber"><Icon name="info" size={18} stroke={2.2} style={{ flex: 'none' }} />{gpsError}</div>}
    </>
  );
}
