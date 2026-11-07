// Tank level bands on the Home tank card (tankLevel in src/api/reservoirs.js).
import { describe, expect, it } from 'vitest';
import { LOW_PCT, forecastRisk, tankLevel } from '../src/api/reservoirs.js';
import { translate } from '../src/i18n.js';

describe('tankLevel', () => {
  it.each([
    [0, 'levelVeryLow'], [9.9, 'levelVeryLow'],
    [10, 'levelLow'], [24.9, 'levelLow'],
    [25, 'levelModerate'], [30, 'levelModerate'], [49.9, 'levelModerate'],
    [50, 'levelGood'], [89.9, 'levelGood'],
    [90, 'levelFull'], [100, 'levelFull'], [104, 'levelFull'],   // readings above 100% happen while spilling
    ['42', 'levelModerate'],                                      // the API can send numbers as text
  ])('%s%% -> %s', (pct, key) => expect(tankLevel(pct)).toBe(key));

  it('no reading, no band', () => {
    expect(tankLevel(null)).toBeNull();
    expect(tankLevel(undefined)).toBeNull();
    expect(tankLevel('n/a')).toBeNull();
  });

  it('every band has a label in every language', () => {
    for (const key of ['levelVeryLow', 'levelLow', 'levelModerate', 'levelGood', 'levelFull']) {
      for (const lang of ['en', 'si', 'ta']) expect(translate(lang, key)).not.toBe(key);
    }
  });
});

it('"Low" starts where the low-water alert and forecast risk start', () => {
  expect(LOW_PCT).toBe(25);
  expect(tankLevel(LOW_PCT - 0.1)).toBe('levelLow');
  expect(tankLevel(LOW_PCT)).toBe('levelModerate');
  expect(forecastRisk({ next: LOW_PCT })).toBe('lowWater');
  expect(forecastRisk({ next: 60 })).toBe('stable');
  expect(forecastRisk({ next: 96 })).toBe('spill');
});

it('"{p}% full" keeps the number in every language (Sinhala and Tamil used to say the tank "is full")', () => {
  expect(translate('en', 'pctFull').replace('{p}', 30)).toBe('30% full');
  expect(translate('si', 'pctFull').replace('{p}', 30)).toBe('ධාරිතාවෙන් 30%');
  expect(translate('ta', 'pctFull').replace('{p}', 30)).toBe('கொள்ளளவில் 30%');
});

it('the 14-day outlook line reads "93% in 14 days (-0.2%)", without a dash running into the minus sign', () => {
  const line = (lang, p, c) => translate(lang, 'outlookLine').replace('{p}', p).replace('{c}', c);
  expect(line('en', 93, '-0.2%')).toBe('93% in 14 days (-0.2%)');
  expect(line('si', 93, '+1.5%')).toBe('දින 14කින් 93% (+1.5%)');
  expect(line('ta', 93, '-0.2%')).toBe('14 நாட்களில் 93% (-0.2%)');
});
