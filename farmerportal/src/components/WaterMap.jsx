import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from './Icon.jsx';
import { MAP_CENTER, MAP_ZOOM } from '../data.js';
import { MAPPED_TANKS } from './GoogleFarmMap.jsx';
import { hideTankNamesWhenFar, lockToSriLanka, makeBaseLayers, pinIcon, tankIcon } from './LeafletFarmMap.jsx';
import { addIrrigationLayers } from '../maps/irrigationLayers.js';
import IrrigationLegend from '../maps/IrrigationLegend.jsx';

/**
 * Free satellite map for the Water page: the farmer's pinned field, the tank they chose
 * at registration (highlighted, with a dashed line to the field) and every other tank.
 */
export default function WaterMap({ pin, tankName, t }) {
  const boxRef = useRef();
  const mapRef = useRef();
  const layersRef = useRef(null);
  if (!layersRef.current) layersRef.current = makeBaseLayers();
  const [base, setBase] = useState('satellite');
  const [layerStatus, setLayerStatus] = useState({ loading: true, error: false, zoomedOut: false });
  const home = pin?.lat != null ? [pin.lat, pin.lng] : [MAP_CENTER.lat, MAP_CENTER.lng];
  // older farms kept the portal's label, e.g. "Senanayaka Sam (…)", so also match "<name> (" (as farmReservoirs does)
  const mine = tankName
    ? MAPPED_TANKS.find((tk) => tk.name === tankName || tk.aka === tankName || tankName.startsWith(`${tk.name} (`))
    : undefined;
  const tankAlias = mine?.name.match(/\(([^)]+)\)/)?.[1];
  const tankNames = [
    tankName,
    mine?.name,
    mine?.aka,
    ...(tankAlias ? [tankAlias] : []),
  ].filter(Boolean);

  const showFarm = () => {
    const map = mapRef.current;
    if (!map) return;
    if (mine && pin?.lat != null) map.fitBounds(L.latLngBounds([home, [mine.pos.lat, mine.pos.lng]]), { padding: [70, 70], maxZoom: 15 });
    else map.setView(home, pin?.lat != null ? 15 : MAP_ZOOM);
  };

  useEffect(() => {
    const map = L.map(boxRef.current, { center: home, zoom: pin?.lat != null ? 14 : MAP_ZOOM, zoomControl: false, scrollWheelZoom: false });
    lockToSriLanka(map);
    map.attributionControl.setPrefix(false);
    map.attributionControl.setPosition('bottomleft');   // bottom-right holds the map legend button
    map.attributionControl.addAttribution('Reservoir, bund & canal data © Sri Lanka Irrigation Department');
    layersRef.current.satellite.forEach((l) => l.addTo(map));
    // tk === mine, not tk.name === tankName: a farm saved with the other spelling (aka) still gets its tank highlighted
    MAPPED_TANKS.forEach((tk) => L.marker([tk.pos.lat, tk.pos.lng], {
      icon: tankIcon(tk.name, tk === mine), interactive: false, keyboard: false, zIndexOffset: tk === mine ? 500 : 0,
    }).addTo(map));
    hideTankNamesWhenFar(map);   // the farmer's own tank keeps its name (styles.css)
    if (pin?.lat != null) {
      if (mine) L.polyline([home, [mine.pos.lat, mine.pos.lng]], { color: '#93d2ee', weight: 3, dashArray: '6 6', interactive: false }).addTo(map);
      L.marker(home, { icon: pinIcon, keyboard: false, title: t('myPlot'), zIndexOffset: 1000 }).addTo(map);
    }
    const irrigationLayers = addIrrigationLayers(map, { names: tankNames, points: mine ? [mine.pos] : [] }, setLayerStatus);
    mapRef.current = map;
    setTimeout(() => { map.invalidateSize(); showFarm(); }, 0);
    return () => { irrigationLayers.remove(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchBase = () => {
    const map = mapRef.current;
    const next = base === 'satellite' ? 'map' : 'satellite';
    if (!map) return;
    layersRef.current[base].forEach((l) => map.removeLayer(l));
    layersRef.current[next].forEach((l) => l.addTo(map));
    setBase(next);
  };

  return (
    <>
      <div ref={boxRef} className="water-map" role="application" aria-label={t('tankCanals')} />
      <IrrigationLegend t={t} status={layerStatus} collapsible showSelected={Boolean(mine)} />
      <div className="map-tools">
        <button type="button" className="icon-btn glass" aria-label={t('a11yZoomIn')} onClick={() => mapRef.current?.zoomIn()}><Icon name="plus" size={20} /></button>
        <button type="button" className="icon-btn glass" aria-label={t('a11yZoomOut')} onClick={() => mapRef.current?.zoomOut()}><span className="f22">−</span></button>
        <button type="button" className="icon-btn glass" aria-label={base === 'satellite' ? t('a11yShowStreet') : t('a11yShowSatellite')} onClick={switchBase}>
          <Icon name={base === 'satellite' ? 'map' : 'globe'} size={20} />
        </button>
        <button type="button" className="icon-btn accent" aria-label={t('a11yShowFarm')} onClick={showFarm}><Icon name="target" size={20} /></button>
      </div>
    </>
  );
}
