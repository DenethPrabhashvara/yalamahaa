// Text shown to the farmer: translations, the farm's place line, alert notes, times and the SMS code box.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LANGS, STRINGS, translate } from '../src/i18n.js';
import { formatDistance, nearestTank, placeLabel } from '../src/components/GoogleFarmMap.jsx';
import { noteText } from '../src/api/alerts.js';
import { hhmm, timeAgo } from '../src/time.js';
import { cleanCode } from '../src/pages/Otp.jsx';

const tFor = (lang) => (key) => translate(lang, key);

describe('translations', () => {
  const en = Object.keys(STRINGS.en);
  it.each(LANGS.filter((l) => l.code !== 'en').map((l) => l.code))('%s has every English key, none empty', (lang) => {
    expect(en.filter((k) => !(k in STRINGS[lang]))).toEqual([]);
    expect(Object.entries(STRINGS[lang]).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k)).toEqual([]);
  });
  it('templates keep their {placeholders} in every language', () => {
    const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    const bad = [];
    for (const k of en) {
      for (const { code } of LANGS) {
        if (holes(STRINGS[code][k]) !== holes(STRINGS.en[k])) bad.push(`${code}.${k}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('falls back to English, then to the key', () => {
    expect(translate('xx', 'acres')).toBe('acres');
    expect(translate('si', 'noSuchKey')).toBe('noSuchKey');
  });
});

describe('formatDistance / nearestTank', () => {
  it.each([[0, '0 m'], [850, '850 m'], [1000, '1.0 km'], [1234, '1.2 km'], [9950, '9.9 km'], [12345, '12 km']])('%i m -> %s', (m, out) => {
    expect(formatDistance(m)).toBe(out);
  });
  it('finds the tank the pin is next to, rounded to 10 m', () => {
    const n = nearestTank({ lat: 8.149064, lng: 80.918553 + 0.001 });   // ~110 m east of Kaudulla's point
    expect(n.name).toBe('Kaudulla');
    expect(n.meters % 10).toBe(0);
    expect(n.meters).toBeGreaterThan(80);
    expect(n.meters).toBeLessThan(140);
  });
});

describe('placeLabel (the farm\'s "1.2 km from Kaudulla" line)', () => {
  it.each([
    ['en', '1.2 km from Kaudulla', '1.2 km from Kaudulla'],
    ['si', '1.2 km from Kaudulla', 'Kaudulla සිට 1.2 km'],
    ['ta', '850 m from Minneriya', 'Minneriya இலிருந்து 850 m'],
    ['si', '12 km from Senanayake Samudraya (Inginiyagala)', 'Senanayake Samudraya (Inginiyagala) සිට 12 km'],
  ])('%s: %s', (lang, saved, shown) => expect(placeLabel(saved, tFor(lang))).toBe(shown));
  it('leaves anything else as it is', () => {
    expect(placeLabel('Hingurakgoda, Polonnaruwa', tFor('si'))).toBe('Hingurakgoda, Polonnaruwa');
    expect(placeLabel('8.05000, 80.98000', tFor('ta'))).toBe('8.05000, 80.98000');
    expect(placeLabel(null, tFor('en'))).toBe('');
    expect(placeLabel(undefined, tFor('en'))).toBe('');
  });
});

describe('time', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T06:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('hhmm is Sri Lanka time whatever the phone says', () => {
    expect(hhmm('2026-11-07T06:00:00Z')).toBe('11:30');
    expect(hhmm('nonsense')).toBe('');
    expect(hhmm(null)).toBe('');
  });
  it('timeAgo steps', () => {
    const t = tFor('en');
    const ago = (s) => timeAgo(new Date(Date.now() - s * 1000).toISOString(), t, 'en');
    expect(ago(10)).toBe(t('justNow'));
    expect(ago(20 * 60)).toBe(`20 ${t('minAgo')}`);
    expect(ago(3 * 3600)).toBe(`3 ${t('hrAgo')}`);
    expect(ago(2 * 86400)).toBe(`2 ${t('daysAgo')}`);
    expect(ago(30 * 86400)).toMatch(/8 Oct/);
    expect(timeAgo('2026-11-08T00:00:00Z', t, 'en')).toMatch(/8 Nov/);   // issued for later: the time itself
    expect(timeAgo('bad', t, 'en')).toBe('');
  });
});

describe('noteText (the app\'s own alert notes)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T06:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  const note = { id: 'f1', kind: 'farm', farmId: 'FAR-0088', acres: 14, at: Date.parse('2026-11-07T05:40:00Z'), read: false };
  it.each([
    ['en', 'Farm registered - FAR-0088', '14 acres'],
    ['si', 'ගොවිපළ ලියාපදිංචි විය - FAR-0088', '14 අක්කර'],
    ['ta', 'பண்ணை பதிவு செய்யப்பட்டது - FAR-0088', '14 ஏக்கர்'],
  ])('%s', (lang, title, body) => {
    const n = noteText(note, tFor(lang), lang);
    expect(n.title).toBe(title);
    expect(n.body).toBe(body);
    expect(n.when).toBe(`20 ${translate(lang, 'minAgo')}`);
    expect(n.read).toBe(false);
  });
  it('no acres, no body; a missing time does not crash', () => {
    const n = noteText({ ...note, acres: null, at: undefined }, tFor('en'), 'en');
    expect(n.body).toBe('');
    expect(n.when).toBe('');
  });
  it('other notes and old English notes are shown as saved', () => {
    const old = { id: 'x', kind: 'farm', title: 'Something else', body: 'b', when: 'Yesterday' };
    expect(noteText(old, tFor('si'), 'si')).toBe(old);
  });
});

describe('cleanCode (the SMS code box)', () => {
  it.each([
    ['123', '123'],
    ['123 456', '123456'],
    ['12-34-56', '123456'],
    ['1234 5678', '123456'],
    ['Your code is 482913.', '482913'],
    ['', ''],
    [null, ''],
  ])('%j -> %j', (input, out) => expect(cleanCode(input)).toBe(out));
});
