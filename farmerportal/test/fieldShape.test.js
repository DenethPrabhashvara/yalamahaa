// Field boundary maths used while the farmer marks the corners (src/fieldShape.js).
import { describe, expect, it } from 'vitest';
import {
  areaAcres, boundaryState, farFromPin, fromGeoJSON, roundAcres, selfIntersects, toGeoJSON, KEEP_BOUNDARY_M,
} from '../src/fieldShape.js';

const LAT = 8.05;
const LNG = 80.98;
// a square about 100 m a side: 0.0009 deg of latitude is 99.5 m; longitude scaled by cos(lat)
const dLat = 0.0009;
const dLng = 0.0009 / Math.cos((LAT * Math.PI) / 180);
const square = [
  { lat: LAT, lng: LNG }, { lat: LAT, lng: LNG + dLng }, { lat: LAT + dLat, lng: LNG + dLng }, { lat: LAT + dLat, lng: LNG },
];
const SQUARE_ACRES = (99.5 * 99.5) / 4046.8564224;   // about 2.45

describe('areaAcres', () => {
  it('measures a ~100 m square', () => {
    expect(areaAcres(square)).toBeCloseTo(SQUARE_ACRES, 1);
  });
  it('is the same whichever way round the corners were tapped', () => {
    // the flat projection is centred on the first corner, so it can differ in the 6th decimal
    expect(areaAcres([...square].reverse())).toBeCloseTo(areaAcres(square), 4);
  });
  it('halves for the triangle of three corners', () => {
    expect(areaAcres(square.slice(0, 3))).toBeCloseTo(areaAcres(square) / 2, 6);
  });
  it('is 0 with fewer than 3 corners or none', () => {
    expect(areaAcres(square.slice(0, 2))).toBe(0);
    expect(areaAcres([])).toBe(0);
    expect(areaAcres(null)).toBe(0);
  });
});

describe('selfIntersects / boundaryState', () => {
  const [a, b, c, d] = square;
  it('a normal field does not cross itself', () => {
    expect(selfIntersects(square)).toBe(false);
    expect(boundaryState(square)).toBe('ok');
  });
  it('corners tapped in a figure 8 cross', () => {
    expect(selfIntersects([a, c, b, d])).toBe(true);
    expect(boundaryState([a, c, b, d])).toBe('crossed');
  });
  it('none / few corners', () => {
    expect(boundaryState([])).toBe('none');
    expect(boundaryState(undefined)).toBe('none');
    expect(boundaryState([a, b])).toBe('few');
    expect(boundaryState([a, b, c])).toBe('ok');
  });
  it('a concave (L-shaped) field is fine', () => {
    const l = [
      { lat: LAT, lng: LNG }, { lat: LAT, lng: LNG + 2 * dLng }, { lat: LAT + dLat, lng: LNG + 2 * dLng },
      { lat: LAT + dLat, lng: LNG + dLng }, { lat: LAT + 2 * dLat, lng: LNG + dLng }, { lat: LAT + 2 * dLat, lng: LNG },
    ];
    expect(boundaryState(l)).toBe('ok');
    expect(areaAcres(l)).toBeCloseTo(3 * areaAcres(square), 3);
  });
});

describe('farFromPin', () => {
  it('keeps the corners when the pin is on or near the field', () => {
    expect(farFromPin(square, { lat: LAT, lng: LNG })).toBe(false);
  });
  it('drops them when the pin moved to another field over 1 km away', () => {
    const away = { lat: LAT + (KEEP_BOUNDARY_M + 200) / 111000, lng: LNG };
    expect(farFromPin(square, away)).toBe(true);
  });
  it('nothing to drop without corners or a pin', () => {
    expect(farFromPin([], { lat: LAT, lng: LNG })).toBe(false);
    expect(farFromPin(square, null)).toBe(false);
  });
});

describe('GeoJSON for the API', () => {
  it('round-trips the corners and closes the ring', () => {
    const geo = toGeoJSON(square);
    expect(geo.type).toBe('Polygon');
    const ring = geo.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    expect(ring[0]).toEqual([LNG, LAT]);   // [lng, lat] order
    const back = fromGeoJSON(geo);
    expect(back).toHaveLength(4);
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(square[i].lat, 7);
      expect(p.lng).toBeCloseTo(square[i].lng, 7);
    });
  });
  it('sends null for an unfinished or crossed shape, so the API clears it', () => {
    expect(toGeoJSON([])).toBeNull();
    expect(toGeoJSON(square.slice(0, 2))).toBeNull();
    const [a, b, c, d] = square;
    expect(toGeoJSON([a, c, b, d])).toBeNull();
  });
  it('reads nothing from a missing or non-polygon value', () => {
    expect(fromGeoJSON(null)).toEqual([]);
    expect(fromGeoJSON({ type: 'Point', coordinates: [LNG, LAT] })).toEqual([]);
  });
});

it('roundAcres: 2 decimals', () => {
  expect(roundAcres(2.345678)).toBe(2.35);
  expect(roundAcres(0.1 + 0.2)).toBe(0.3);
});
