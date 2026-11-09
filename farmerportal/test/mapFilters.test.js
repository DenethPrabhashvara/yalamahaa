// The irrigation map shows only the tanks we have water data for (src/maps/tankFilter.js), and the
// pin map ignores locations outside Sri Lanka (inSriLanka in src/data.js).
import { describe, expect, it } from 'vitest';
import { dataKeysFor, dataTanks, keepDataTanks, nameMatches, simplifyName } from '../src/maps/tankFilter.js';
import { MAP_CENTER, inSriLanka } from '../src/data.js';
import { RESERVOIRS } from '../src/reservoirs.js';
import { translate } from '../src/i18n.js';

const fc = (...names) => ({ type: 'FeatureCollection', features: names.map((n) => ({ type: 'Feature', properties: { Res_Name: n }, geometry: null })) });
const names = (geojson) => geojson.features.map((f) => f.properties.Res_Name);

describe('simplifyName', () => {
  it('ignores case, spaces, accents and words like wewa / tank', () => {
    expect(simplifyName('Hurulu Wewa')).toBe('hurulu');
    expect(simplifyName('KAUDULLA TANK')).toBe('kaudulla');
    expect(simplifyName('Parakrama Samudraya')).toBe('parakrama');
    expect(simplifyName('Kalā Wewa')).toBe('kala');
  });
  it('"wewa" joined onto the name is not dropped: those tanks are matched by position instead', () => {
    expect(nameMatches('Hurulu Wewa', ['Huruluwewa'])).toBe(false);
    expect(nameMatches('Kantalai', ['Kantale'])).toBe(false);
  });
  it('nothing in, nothing out', () => {
    expect(simplifyName(null)).toBe('');
    expect(nameMatches('', ['Kaudulla'])).toBe(false);
    expect(nameMatches(undefined, [''])).toBe(false);
  });
});

describe('dataTanks', () => {
  it('keeps every spelling: name, aka and the name in brackets', () => {
    const [tk] = dataTanks([{ name: 'Senanayake Samudraya (Inginiyagala)', aka: 'Gal Oya', pos: { lat: 7.2, lng: 81.5 } }]);
    expect(tk.names).toEqual(['Senanayake Samudraya (Inginiyagala)', 'Gal Oya', 'Inginiyagala']);
    expect(tk.pos).toEqual({ lat: 7.2, lng: 81.5 });
  });
  it('covers all the tanks the app has readings for', () => {
    const tanks = dataTanks(RESERVOIRS.map((r) => ({ ...r, pos: { lat: r.lat, lng: r.lon } })));
    expect(tanks).toHaveLength(RESERVOIRS.length);
    tanks.forEach((tk) => expect(tk.names.length).toBeGreaterThan(0));
  });
});

describe('keepDataTanks', () => {
  const keys = dataKeysFor([{ names: ['Kaudulla', 'Minneriya'] }], ['Giritale Wewa']);

  it('drops reservoirs we have no data for', () => {
    expect(names(keepDataTanks('reservoir', fc('Kaudulla Wewa', 'Small village tank', 'MINNERIYA'), keys))).toEqual(['Kaudulla Wewa', 'MINNERIYA']);
  });
  it('keeps a tank found by position under the GIS spelling', () => {
    expect(names(keepDataTanks('reservoir', fc('Giritale Wewa', 'Other'), keys))).toEqual(['Giritale Wewa']);
  });
  it.each(['tank', 'bund', 'sluice', 'spill'])('filters a tank\'s %s the same way', (kind) => {
    expect(names(keepDataTanks(kind, fc('Kaudulla', 'Kuda wewa'), keys))).toEqual(['Kaudulla']);
  });
  it.each(['canal', 'area'])('keeps every %s (named by scheme, not tank)', (kind) => {
    expect(names(keepDataTanks(kind, fc('Anything', null), keys))).toEqual(['Anything', null]);
  });
  it('keeps everything when the farmer chose Show all reservoirs', () => {
    const all = fc('Kaudulla', 'Kuda wewa');
    expect(keepDataTanks('reservoir', all, null)).toBe(all);
  });
  it('drops unnamed tank features (no name can match)', () => {
    expect(names(keepDataTanks('reservoir', fc(null, ''), keys))).toEqual([]);
  });
  it('does not change the downloaded data', () => {
    const data = fc('Kaudulla', 'Kuda wewa');
    keepDataTanks('reservoir', data, keys);
    expect(names(data)).toEqual(['Kaudulla', 'Kuda wewa']);
  });
});

describe('inSriLanka', () => {
  it.each([
    ['Colombo', { lat: 6.93, lng: 79.85 }],
    ['Kaudulla', { lat: 8.15, lng: 80.90 }],
    ['Point Pedro', { lat: 9.82, lng: 80.23 }],
    ['Dondra Head', { lat: 5.92, lng: 80.59 }],
    ['the map centre', MAP_CENTER],
  ])('%s is in', (_, p) => expect(inSriLanka(p)).toBe(true));
  it.each([
    ['Sydney (a VPN)', { lat: -33.86, lng: 151.2 }],
    ['Bay of Bengal', { lat: 13.5, lng: 86.0 }],
    ['Chennai', { lat: 13.08, lng: 80.27 }],
    ['Rameswaram', { lat: 9.29, lng: 79.31 }],
    ['0, 0', { lat: 0, lng: 0 }],
  ])('%s is out', (_, p) => expect(inSriLanka(p)).toBe(false));
  it('no pin is not in Sri Lanka', () => {
    expect(inSriLanka(null)).toBe(false);
    expect(inSriLanka({ lat: null, lng: null })).toBe(false);
    expect(inSriLanka({ lat: 8 })).toBe(false);
  });
});

describe('new text', () => {
  const keys = ['mapShowAll', 'mapAllTitle', 'mapAllBody', 'mapAllBodyReg', 'mapAllShown', 'mapHide', 'mapCancel', 'tankNoDataNote', 'gpsOutsideSriLanka', 'gate'];
  it.each(['en', 'si', 'ta'])('%s has every new message', (lang) => {
    keys.forEach((k) => {
      const text = translate(lang, k);
      expect(text, k).toBeTruthy();
      expect(text, k).not.toBe(k);
    });
  });
  it('the reservoir messages promise rain and river flood alerts, not "no data"', () => {
    ['mapAllBody', 'mapAllBodyReg', 'tankNoDataNote'].forEach((k) => {
      const text = translate('en', k);
      expect(text).toMatch(/3-day rain alerts/);
      expect(text).toMatch(/river flood alerts/);
      expect(text).not.toMatch(/don.t have|no data/i);
    });
  });
});
