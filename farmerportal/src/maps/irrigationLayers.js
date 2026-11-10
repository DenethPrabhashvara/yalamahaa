import L from 'leaflet';
import { dataKeysFor, keepDataTanks, nameMatches, simplifyName } from './tankFilter.js';

const LAYER_URL = 'https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/Scheme_Data_2/FeatureServer';
const LAYERS = [
  { id: 9, name: 'Irrigable area', fields: 'OBJECTID,Scheme,Type,Division,Irrig_Area_SchemeRegister_ha', kind: 'area' },
  { id: 8, name: 'Canal system', fields: 'OBJECTID,Scheme,Canal_Type,Division,Code', kind: 'canal' },
  { id: 10, name: 'Reservoir', fields: 'OBJECTID,Res_Name,Division,Type,Tank_Code', kind: 'reservoir', preserveGeometry: true },
  { id: 7, name: 'Bund', fields: 'OBJECTID_1,Res_Name,Division,Res_Type,Tank_Code,Bund_Length_m,Bund_Top_Width_m', kind: 'bund' },
  { id: 3, name: 'Tank coordinate', fields: 'OBJECTID,Res_Name,Division,Res_Type,Tank_Code', kind: 'tank' },
  { id: 2, name: 'Sluice', fields: 'FID,Res_Name,Division,Location,Tank_Code', kind: 'sluice' },
  { id: 1, name: 'Spill', fields: 'OBJECTID_12,Res_Name,Division,Spill_Type,Location,Tank_Code', kind: 'spill' },
];
const LOW_ZOOM_LAYERS = new Set(['reservoir', 'tank']);
const COLORS = {
  area: '#dff0df',
  canal: '#2996ff',
  // every reservoir and tank, whatever its size, and the farmer's own (which only pulses): one soft
  // blue that sits quietly on the green imagery (the top-left blue of the desktop background, .stage)
  reservoir: '#88bfe6',
  reservoirEdge: '#4f97cf',
  bund: '#b35933',
  tank: '#88bfe6',
  sluice: '#ffd166',
  spill: '#ed5353',
  // the tank's own canals and bunds and the fields it waters, when it is the farmer's tank
  highlight: '#a8c8f0',
};

// The GIS often spells a tank differently from the app (Kantalai / Kantale, Hurulu wewa /
// Huruluwewa, ~40 of the 117), so the selected tank is also found by position: the reservoir
// outline that contains the tank's point, else the nearest one within MATCH_RADIUS_M. That
// outline's own Res_Name then selects its bunds, canals, sluices and spills too.
const MATCH_RADIUS_M = 1000;

// metres from point p to segment a-b, all [lng, lat], on a local flat projection
function segmentDistance(p, a, b) {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110540;
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
  const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

// polygon rings of a GeoJSON Polygon / MultiPolygon
const ringsOf = (geometry) => (geometry?.type === 'Polygon' ? geometry.coordinates
  : geometry?.type === 'MultiPolygon' ? geometry.coordinates.flat() : []);

// 0 when p is inside the outline, else metres to its edge
function distanceToOutline(p, rings) {
  let inside = false;
  let best = Infinity;
  rings.forEach((ring) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
      best = Math.min(best, segmentDistance(p, ring[j], ring[i]));
    }
  });
  return inside ? 0 : best;
}

// GIS names of the reservoir outlines at or next to the given tanks' points. Each outline's box
// (grown by MATCH_RADIUS_M) is checked first, so matching all 117 tanks against ~1000 outlines stays cheap.
const PAD_DEG = MATCH_RADIUS_M / 100000;
function namesAtPoints(loaded, points) {
  const reservoirs = (loaded.find(({ layer }) => layer.kind === 'reservoir')?.data.features || []).map((feature) => {
    const rings = ringsOf(feature.geometry);
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    rings.forEach((ring) => ring.forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }));
    return { rings, name: feature.properties?.Res_Name, box: [w - PAD_DEG, s - PAD_DEG, e + PAD_DEG, n + PAD_DEG] };
  });
  const names = [];
  points.forEach(({ lat, lng }) => {
    let best = null;
    reservoirs.forEach(({ rings, name, box }) => {
      if (lng < box[0] || lat < box[1] || lng > box[2] || lat > box[3]) return;
      const d = distanceToOutline([lng, lat], rings);
      if (d <= MATCH_RADIUS_M && (!best || d < best.d)) best = { d, name };
    });
    if (best?.name) names.push(best.name);
  });
  return names;
}


function popupContent(properties, kind) {
  const fields = {
    area: [['Scheme', 'Scheme'], ['Type', 'Type'], ['Irrigable area (ha)', 'Irrig_Area_SchemeRegister_ha']],
    canal: [['Scheme', 'Scheme'], ['Canal type', 'Canal_Type'], ['Division', 'Division']],
    reservoir: [['Tank', 'Res_Name'], ['Division', 'Division'], ['Type', 'Type']],
    bund: [['Tank bund', 'Res_Name'], ['Bund length (m)', 'Bund_Length_m'], ['Top width (m)', 'Bund_Top_Width_m']],
    tank: [['Tank', 'Res_Name'], ['Division', 'Division'], ['Type', 'Res_Type']],
    sluice: [['Sluice', 'Location'], ['Tank', 'Res_Name'], ['Division', 'Division']],
    spill: [['Spill', 'Spill_Type'], ['Tank', 'Res_Name'], ['Division', 'Division']],
  }[kind];
  const content = document.createElement('div');
  fields.forEach(([label, key]) => {
    const value = properties[key];
    if (value == null || value === '') return;
    const row = document.createElement('div');
    row.textContent = `${label}: ${value}`;
    content.appendChild(row);
  });
  return content;
}

function featureStyle(kind, selected) {
  // fields watered by the highlighted tank (irrigable areas carry their tank's name): outlined
  // and lightly tinted, so they don't look like part of the tank itself
  if (selected && kind === 'area') {
    return { color: COLORS.highlight, weight: 2, opacity: 0.85, dashArray: '5 4', fillColor: COLORS.highlight, fillOpacity: 0.06 };
  }
  if (selected) {
    // the tank's own canals and bunds: steady (only the tank itself pulses)
    return { color: COLORS.highlight, weight: kind === 'bund' ? 4 : 3, opacity: 0.9 };
  }
  if (kind === 'area') return { color: '#00a884', weight: 1, fillColor: COLORS.area, fillOpacity: 0.18 };
  if (kind === 'canal') return { color: COLORS.canal, weight: 2, opacity: 0.85 };
  if (kind === 'bund') return { color: COLORS.bund, weight: 3, opacity: 0.95 };
  return {};
}

// interactive = false: the shapes ignore taps (no popups), so a tap on an irrigable area or
// reservoir reaches the map below. Leaflet stops the map click when it opens a feature's popup.
// The farmer's own tank (outline and point) is drawn in a layer of its own, and that whole layer
// pulses by opacity (.leaflet-tank-pulse-pane in styles.css). Opacity on its own layer is animated by
// the GPU; pulsing the shape's fill-opacity inside the shared SVG made the phone repaint every shape on
// the map 60 times a second (and the glass over it re-bend), which is what made budget phones lag.
const PULSE_PANE = 'tank-pulse';
const isPulsing = (layer, feature, selectedTankName) => (layer.kind === 'reservoir' || layer.kind === 'tank')
  && nameMatches(feature.properties?.Res_Name || feature.properties?.Scheme, selectedTankName);

function makeLayer(layer, geojson, selectedTankName, interactive, pulseRenderer, dataKeys) {
  geojson = keepDataTanks(layer.kind, geojson, dataKeys);   // the tanks we have data for (tankFilter.js)
  const steady = makeGeoJSON(layer, geojson, selectedTankName, interactive, (f) => !isPulsing(layer, f, selectedTankName), {});
  if (!pulseRenderer || !geojson.features.some((f) => isPulsing(layer, f, selectedTankName))) return steady;
  const pulsing = makeGeoJSON(layer, geojson, selectedTankName, interactive, (f) => isPulsing(layer, f, selectedTankName),
    { pane: PULSE_PANE, renderer: pulseRenderer });
  return L.layerGroup([steady, pulsing]);
}

function makeGeoJSON(layer, geojson, selectedTankName, interactive, filter, paneOptions) {
  return L.geoJSON(geojson, {
    interactive,
    filter,
    ...paneOptions,
    style: (feature) => {
      const name = feature.properties?.Res_Name || feature.properties?.Scheme;
      const selected = nameMatches(name, selectedTankName);
      if (layer.kind === 'reservoir') {
        // the same blue for every tank; the farmer's own pulses (its layer, see PULSE_PANE)
        return { color: COLORS.reservoirEdge, weight: 2, opacity: 0.9, fillColor: COLORS.reservoir, fillOpacity: selected ? 0.7 : 0.6 };
      }
      return featureStyle(layer.kind, selected);
    },
    pointToLayer: (feature, latlng) => {
      const selected = nameMatches(feature.properties?.Res_Name, selectedTankName);
      return L.circleMarker(latlng, {
        interactive,
        ...paneOptions,
        radius: selected ? 7 : 5,
        color: layer.kind === 'tank' ? COLORS.reservoirEdge : '#15283f',
        weight: selected ? 2 : 1,
        fillColor: COLORS[layer.kind],
        fillOpacity: 0.95,
      });
    },
    onEachFeature: (feature, featureLayer) => {
      if (interactive) featureLayer.bindPopup(popupContent(feature.properties || {}, layer.kind));
    },
  });
}

// Full-detail reservoir outlines only when zoomed in enough to see the difference: zoomed out to
// the whole island they are a ~5 MB download (and again on every pan), simplified they are tiny.
const FULL_DETAIL_ZOOM = 13;

async function fetchLayer(layer, bounds, tolerance, zoom, signal) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: bounds.toBBoxString(),
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outSR: '4326',
    outFields: layer.fields,
    returnGeometry: 'true',
    resultRecordCount: '1000',
    f: 'geojson',
  });
  if (!layer.preserveGeometry || zoom < FULL_DETAIL_ZOOM) {
    params.set('maxAllowableOffset', String(tolerance));
    params.set('geometryPrecision', '5');
  }
  const response = await fetch(`${LAYER_URL}/${layer.id}/query?${params}`, { signal });
  if (!response.ok) throw new Error(`${layer.name} layer request failed (${response.status})`);
  const geojson = await response.json();
  if (geojson.error || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
    throw new Error(geojson.error?.message || `${layer.name} layer returned invalid map data`);
  }
  return geojson;
}

/**
 * Loads the public Sri Lanka Irrigation Department map features for the visible area.
 * The existing basemap and reservoir labels remain in place if any GIS layer is unavailable.
 * selection: { names, points } (or a function returning it) for the tank(s) to highlight;
 *   names are app spellings, points ({ lat, lng }) find the outline when the GIS spells it differently.
 * options.interactive (default true): false on maps where a tap must place a pin.
 * options.dataTanks: [{ names, pos }] for the tanks we have readings for. When given, other reservoirs
 *   and tanks are hidden until setShowAll(true).
 * Fires on 'moveend' (fetch for the new area) and 'irrigationselectionchange' (restyle only).
 */
export function addIrrigationLayers(map, selection, onStatus, { interactive = true, dataTanks } = {}) {
  let controller;
  let timer;
  let requestId = 0;
  let visibleLayers = L.layerGroup().addTo(map);
  let loaded = []; // [{ layer, data }] from the last fetch, so a new selection doesn't download again
  if (!map.getPane(PULSE_PANE)) map.createPane(PULSE_PANE).style.zIndex = 401;   // just above the other shapes
  const pulseRenderer = L.svg({ pane: PULSE_PANE });
  let pulsed = false;
  let showAll = false;
  let dataKeys = null;   // simplified names, worked out once per download, not on every restyle

  const render = () => {
    const { names: given = [], points = [] } = (typeof selection === 'function' ? selection() : selection) || {};
    const names = [...given, ...namesAtPoints(loaded, points)];
    if (dataTanks && !dataKeys) {
      dataKeys = dataKeysFor(dataTanks, namesAtPoints(loaded, dataTanks.map((tk) => tk.pos)));
    }
    const only = dataTanks && !showAll ? new Set([...dataKeys, ...names.map(simplifyName)]) : null;
    const nextLayers = L.layerGroup();
    loaded.forEach(({ layer, data }) => nextLayers.addLayer(makeLayer(layer, data, names, interactive, pulseRenderer, only)));
    map.removeLayer(visibleLayers);
    visibleLayers = nextLayers.addTo(map);
    // The 4 pulses start when the farmer's tank is first drawn (its outline arrives a few seconds after
    // the map opens), not when the map was created. Panning later doesn't start them again.
    if (!pulsed && map.getPane(PULSE_PANE).querySelector('path')) {
      pulsed = true;
      map.getPane(PULSE_PANE).getAnimations?.().forEach((a) => { a.currentTime = 0; a.play(); });
    }
  };

  const update = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      controller?.abort();
      controller = new AbortController();
      const currentController = controller;
      const currentRequest = ++requestId;
      const zoom = map.getZoom();
      const layers = zoom < 11 ? LAYERS.filter((layer) => LOW_ZOOM_LAYERS.has(layer.kind)) : LAYERS;
      const bounds = map.getBounds();
      const tolerance = Math.min(0.0015, Math.max(0.00001, ((bounds.getNorth() - bounds.getSouth()) / map.getSize().y) * 1.5));
      onStatus?.({ loading: true, error: false, zoomedOut: zoom < 11 });

      const results = await Promise.allSettled(
        layers.map(async (layer) => ({ layer, data: await fetchLayer(layer, bounds, tolerance, zoom, currentController.signal) })),
      );
      if (currentController.signal.aborted || currentRequest !== requestId) return;

      const failures = [];
      loaded = [];
      dataKeys = null;
      results.forEach((result) => {
        if (result.status === 'fulfilled') loaded.push(result.value);
        else if (result.reason?.name !== 'AbortError') failures.push(result.reason);
      });
      if (failures.length) console.error('Unable to load some irrigation map layers:', failures);
      // more features in view than one request returns (resultRecordCount): some are missing, so ask to zoom in
      const cutOff = loaded.some(({ data }) => data.properties?.exceededTransferLimit || data.exceededTransferLimit);
      render();
      onStatus?.({ loading: false, error: failures.length > 0, zoomedOut: zoom < 11 || cutOff });
    }, 140);
  };

  map.on('moveend', update);
  map.on('irrigationselectionchange', render);
  update();

  return {
    refresh: update,
    setShowAll: (value) => { showAll = Boolean(value); render(); },
    remove: () => {
      clearTimeout(timer);
      controller?.abort();
      map.off('moveend', update);
      map.off('irrigationselectionchange', render);
      map.removeLayer(visibleLayers);
      if (map.hasLayer(pulseRenderer)) map.removeLayer(pulseRenderer);
    },
  };
}
