// Field boundary maths, the same as the API's api/services/fieldShape.js
// (the API works the area out again itself; this is only for showing it while drawing).
// In the app a boundary is a list of corners [{ lat, lng }]; the API takes a GeoJSON Polygon.
import { haversine } from './api/googleMaps.js';

export const M2_PER_ACRE = 4046.8564224;
export const MIN_CORNERS = 3;
export const MAX_CORNERS = 60;
// A pin moved further than this from the drawn field means it's a different field.
export const KEEP_BOUNDARY_M = 1000;

const EARTH_M = 6371008.8;

function toMetres(points) {
  const lat0 = (points[0].lat * Math.PI) / 180;
  const k = (Math.PI / 180) * EARTH_M;
  return points.map((p) => [(p.lng - points[0].lng) * k * Math.cos(lat0), (p.lat - points[0].lat) * k]);
}

export function areaAcres(points) {
  if (!points || points.length < MIN_CORNERS) return 0;
  const p = toMetres(points);
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2 / M2_PER_ACRE;
}

// true if two edges that don't share a corner cross (a figure-8 field)
export function selfIntersects(points) {
  if (!points || points.length < 4) return false;
  const p = toMetres(points);
  const n = p.length;
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  for (let i = 0; i < n; i++) {
    const a = p[i]; const b = p[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if ((j + 1) % n === i || j === (i + 1) % n) continue;
      const c = p[j]; const d = p[(j + 1) % n];
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
    }
  }
  return false;
}

export function centre(points) {
  const n = points.length;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / n, lng: points.reduce((s, p) => s + p.lng, 0) / n };
}

// 'ok', 'none' (nothing drawn = skipped), 'few' (1-2 corners) or 'crossed'
export function boundaryState(points) {
  if (!points?.length) return 'none';
  if (points.length < MIN_CORNERS) return 'few';
  if (selfIntersects(points)) return 'crossed';
  return 'ok';
}

export function farFromPin(points, pin) {
  return Boolean(points?.length && pin?.lat != null && haversine(centre(points), pin) > KEEP_BOUNDARY_M);
}

export const roundAcres = (a) => Math.round(a * 100) / 100;

export function toGeoJSON(points) {
  if (boundaryState(points) !== 'ok') return null;
  const ring = points.map((p) => [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))]);
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] };
}

export function fromGeoJSON(geo) {
  const ring = geo?.type === 'Polygon' ? geo.coordinates?.[0] : null;
  if (!ring?.length) return [];
  return ring.slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
}
