// App state helpers (src/state/AppContext.jsx): phone and NIC checks, the farm sent to the API,
// the farm read back from it, and the clean-up of state saved by older versions of the app.
import { describe, expect, it } from 'vitest';
import {
  emptyDraft, farmFromProfile, farmPayload, formatPhone, maskPhone, migrateSaved, newCrop, nicInfo, normalizePhone,
} from '../src/state/AppContext.jsx';

describe('normalizePhone', () => {
  it.each([
    ['0771234567', '+94771234567'],
    ['077 123 4567', '+94771234567'],
    ['+94 77 123 4567', '+94771234567'],
    ['94771234567', '+94771234567'],
    ['771234567', '+94771234567'],
  ])('%s -> %s', (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(['0112345678', '07712345', '077123456789', '', 'abc'])('rejects %s (not a Sri Lankan mobile)', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

it('formatPhone / maskPhone', () => {
  expect(formatPhone('+94771234567')).toBe('+94 77 123 4567');
  expect(maskPhone('+94771234567')).toBe('+94 77 ••• 4567');
  expect(maskPhone('')).toBe('');
});

describe('nicInfo', () => {
  it('old format: 9 digits + V/X, any case and spaces', () => {
    expect(nicInfo(' 821453298v ')).toMatchObject({ valid: true, format: 'old', masked: '8214•••98V' });
    expect(nicInfo('821453298X').valid).toBe(true);
  });
  it('new format: 12 digits starting 19 or 20', () => {
    expect(nicInfo('198421098456')).toMatchObject({ valid: true, format: 'new', masked: '1984•••••456' });
    expect(nicInfo('200112345678').valid).toBe(true);
  });
  it.each(['82145329V', '821453298', '188421098456', '19842109845', ''])('rejects %s', (v) => {
    expect(nicInfo(v).valid).toBe(false);
  });
});

describe('farmPayload (what registration / edit sends)', () => {
  const draft = () => ({
    ...emptyDraft(),
    crops: [{ ...newCrop(), acres: '2.5', yield: '1,800' }, { ...newCrop(), category: 'vegetables', type: 'Tomato', variety: 'Thilina', acres: 1, yield: '' }],
    water: { source: 'tank', name: ' Kaudulla ' },
    nearest: '1.2 km from Kaudulla',
    totalAcres: '14',
    boundary: [],
    flood: { history: 'once', depth: 'knee', lastYear: 2024 },
  });
  it('maps the draft to the API fields', () => {
    const p = farmPayload(draft());
    expect(p).toMatchObject({ water_source: 'tank', water_name: 'Kaudulla', location_label: '1.2 km from Kaudulla', total_acres: 14, boundary: null, flood_history: 'once', flood_depth: 'knee', flood_last_year: 2024 });
    expect(p.crops[0]).toMatchObject({ category: 'paddy', crop_type: '3.5 months', variety: 'Bg 352', acres: 2.5, last_yield: 1800, yield_unit: 'kg' });
    expect(p.crops[1].last_yield).toBeNull();
  });
  it('an empty total clears it; a missing total (older app version) is not sent at all', () => {
    expect(farmPayload({ ...draft(), totalAcres: '' }).total_acres).toBeNull();
    const old = draft();
    delete old.totalAcres; delete old.boundary; delete old.flood;
    const p = farmPayload(old);
    expect('total_acres' in p).toBe(false);
    expect('boundary' in p).toBe(false);
    expect('flood_history' in p).toBe(false);
  });
  it('a skipped flood step clears the flood answers', () => {
    expect(farmPayload({ ...draft(), flood: null })).toMatchObject({ flood_history: null, flood_depth: null, flood_last_year: null });
  });
  it('no water source chosen', () => {
    expect(farmPayload({ ...draft(), water: null })).toMatchObject({ water_source: null, water_name: null });
  });
});

describe('farmFromProfile (the farm read back from the API)', () => {
  const farmer = {
    farmer_id: 'u1', farm_id: 'FAR-1', full_name: 'Sunil Bandara', phone: '+94771234567', address: 'No 12', district: 'Polonnaruwa', division: null,
    farm_latitude: '8.050000', farm_longitude: '80.980000', reservoir_id: 5, sms_enabled: false, created_at: '2026-01-02T03:04:05Z',
    farm: {
      water_source: 'canal', water_name: 'Kaudulla - Left Bank', location_label: '1.2 km from Kaudulla', total_acres: '14.00',
      boundary: { type: 'Polygon', coordinates: [[[80.98, 8.05], [80.981, 8.05], [80.981, 8.051], [80.98, 8.05]]] },
      flood_history: 'several', flood_depth: 'waist', flood_last_year: 2023,
      crops: [{ category: 'paddy', crop_type: '3.5 months', variety: 'Bg 352', acres: '2.00', last_yield: '1800.00', yield_unit: 'kg' }],
    },
  };
  it('reads every field the edit screens use', () => {
    const f = farmFromProfile(farmer);
    expect(f).toMatchObject({
      id: 'FAR-1', name: 'Sunil Bandara', pin: { lat: 8.05, lng: 80.98 }, located: true, nearest: '1.2 km from Kaudulla',
      water: { source: 'canal', name: 'Kaudulla - Left Bank' }, totalAcres: '14', reservoirId: 5, smsEnabled: false,
      flood: { history: 'several', depth: 'waist', lastYear: 2023 },
    });
    expect(f.boundary).toHaveLength(3);
    expect(f.crops[0]).toMatchObject({ category: 'paddy', type: '3.5 months', variety: 'Bg 352', acres: 2, yield: '1800', unit: 'kg' });
  });
  it('a saved total counts as typed, so the field step keeps it instead of following the corners', () => {
    expect(farmFromProfile(farmer).totalTyped).toBe(true);
    const none = farmFromProfile({ ...farmer, farm: { ...farmer.farm, total_acres: null } });
    expect(none.totalAcres).toBe('');
    expect(none.totalTyped).toBe(false);
  });
  it('older crop names are matched to the current catalog', () => {
    const f = farmFromProfile({ ...farmer, farm: { ...farmer.farm, crops: [
      { category: 'paddy', crop_type: 'White Rice (BG)', variety: 'BG 358 Samba', acres: 1 },
      { category: 'fruit', crop_type: 'Mango', variety: 'Villard', acres: 1 },
      { category: 'nonsense', crop_type: 'paddy', variety: 'x', acres: 1 },
    ] } });
    expect(f.crops[0]).toMatchObject({ type: '3.5 months', variety: 'Bg 358' });
    expect(f.crops[1]).toMatchObject({ category: 'fruit', type: 'Mango', variety: 'Willard' });
    expect(f.crops[2]).toMatchObject({ category: 'paddy', type: '3.5 months', variety: 'Bg 352' });
  });
  it('no farm details yet: one crop from the farmer row, the tank from reservoir_id, the place from the district', () => {
    const f = farmFromProfile({ ...farmer, farm: null, farm_latitude: null, farm_longitude: null, primary_crop: '3 months', land_acres: '3' }, 'Minneriya');
    expect(f.crops).toHaveLength(1);
    expect(f.crops[0]).toMatchObject({ type: '3 months', acres: 3 });
    expect(f.water).toEqual({ source: 'tank', name: 'Minneriya' });
    expect(f.pin).toBeNull();
    expect(f.located).toBe(false);
    expect(f.nearest).toBe('Polonnaruwa');
    expect(f.smsEnabled).toBe(false);
  });
});

describe('migrateSaved (state saved by an older app version)', () => {
  const user = { phone: '+94771234567', farmerId: 'u1' };
  it('nothing saved', () => {
    expect(migrateSaved(null)).toBeNull();
  });
  it('signs out demo sessions with no server account', () => {
    const s = migrateSaved({ user: { phone: '+94771234567' }, farm: { id: 'X' } });
    expect(s.user).toBeNull();
    expect(s.farm).toBeNull();
  });
  it('keeps a sign-up in progress', () => {
    expect(migrateSaved({ user: { phone: '+94771234567', pendingRegistration: true } }).user.pendingRegistration).toBe(true);
  });
  it('turns old English "Farm registered" notes into facts, one per farm, keeping the original', () => {
    const s = migrateSaved({ user, alerts: [
      { id: 'f1762000000000', kind: 'farm', title: 'Farm registered - FAR-1', body: '14 acres registered.', when: 'Just now', read: false },
      { id: 'other', kind: 'farm', title: 'Something else', body: 'x', read: false },
      { id: 'f1761000000000', kind: 'farm', title: 'Farm registered - FAR-1', body: '2.5 acres registered.', when: 'Just now', read: true },
      { id: 'f1760000000000', kind: 'farm', title: 'Farm registered - FAR-2', body: 'acres registered.', when: 'Just now', read: false },
      { id: 'sample', kind: 'flood', title: 'old sample alert' },
    ] });
    expect(s.alerts).toEqual([
      { id: 'other', kind: 'farm', title: 'Something else', body: 'x', read: false },
      { id: 'f1761000000000', kind: 'farm', farmId: 'FAR-1', acres: 2.5, at: 1761000000000, read: true },
      { id: 'f1760000000000', kind: 'farm', farmId: 'FAR-2', acres: null, at: 1760000000000, read: false },
    ]);
  });
  it('already-migrated notes are left alone (safe to run on every start)', () => {
    const once = migrateSaved({ user, alerts: [{ id: 'f1', kind: 'farm', farmId: 'FAR-1', acres: 2, at: 1, read: false }] });
    expect(migrateSaved(structuredClone(once)).alerts).toEqual(once.alerts);
  });
  it('drops the old SMS flag and fixes middle dots in canal names', () => {
    const s = migrateSaved({ user, smsEnabled: false, farm: { water: { name: 'Kaudulla · Lower' } }, draft: { water: { name: 'A · B' } } });
    expect('smsEnabled' in s).toBe(false);
    expect(s.farm.water.name).toBe('Kaudulla - Lower');
    expect(s.draft.water.name).toBe('A - B');
  });
});
