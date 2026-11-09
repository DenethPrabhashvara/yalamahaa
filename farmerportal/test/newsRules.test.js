// Weather warning text from the Department of Meteorology (src/api/newsRules.js): how the sheet on
// the News page splits it into a description and titled sections of points.
import { describe, expect, it } from 'vitest';
import { bodyText, instructionSections, instructionSteps, newsTitle } from '../src/api/newsRules.js';

// as the API sends it (GET /api/data/news), shortened
const LIGHTNING = 'Action Required: • Suspend or postpone outdoor sports, construction, agricultural, and recreational activities when thunderstorms approach. • Move immediately into a substantial building. • Avoid beaches, swimming areas, lakes, rivers, and other water bodies.\n'
  + 'Damage Expected: • Increased probability of thunderstorms and lightning strikes. • Damage to electrical and electronic equipment.';

describe('instructionSections', () => {
  it('splits the real feed text into its two titled sections', () => {
    expect(instructionSections(LIGHTNING)).toEqual([
      { title: 'Action Required', items: [
        'Suspend or postpone outdoor sports, construction, agricultural, and recreational activities when thunderstorms approach.',
        'Move immediately into a substantial building.',
        'Avoid beaches, swimming areas, lakes, rivers, and other water bodies.',
      ] },
      { title: 'Damage Expected', items: [
        'Increased probability of thunderstorms and lightning strikes.',
        'Damage to electrical and electronic equipment.',
      ] },
    ]);
  });

  it('a title on its own line takes the points on the lines after it', () => {
    expect(instructionSections('Action Required:\n• Stay indoors\n• Unplug appliances')).toEqual([
      { title: 'Action Required', items: ['Stay indoors', 'Unplug appliances'] },
    ]);
  });

  it('Sinhala and Tamil titles work the same way', () => {
    expect(instructionSections('අවශ්‍ය ක්‍රියාමාර්ග: • නිවස තුළ සිටින්න • විදුලි උපකරණ ගලවන්න')).toEqual([
      { title: 'අවශ්‍ය ක්‍රියාමාර්ග', items: ['නිවස තුළ සිටින්න', 'විදුලි උපකරණ ගලවන්න'] },
    ]);
    expect(instructionSections('தேவையான நடவடிக்கை: • வீட்டுக்குள் இருங்கள்')[0].title).toBe('தேவையான நடவடிக்கை');
  });

  it('text without titles or bullets is one untitled section', () => {
    expect(instructionSections('Stay indoors. Avoid open fields.')).toEqual([{ title: null, items: ['Stay indoors. Avoid open fields.'] }]);
    expect(instructionSections('- Stay indoors\n- Avoid open fields')).toEqual([{ title: null, items: ['Stay indoors', 'Avoid open fields'] }]);
  });

  it('a sentence with a colon later on is not mistaken for a title', () => {
    expect(instructionSections('Keep away from water. Note: rivers may rise fast.')).toEqual([
      { title: null, items: ['Keep away from water. Note: rivers may rise fast.'] },
    ]);
  });

  it('nothing to show', () => {
    expect(instructionSections(null)).toEqual([]);
    expect(instructionSections('')).toEqual([]);
    expect(instructionSections('Action Required:')).toEqual([]);
  });
});

it('instructionSteps: the points without the titles (the bell shows the first)', () => {
  const steps = instructionSteps(LIGHTNING);
  expect(steps[0]).toMatch(/^Suspend or postpone/);
  expect(steps).toHaveLength(5);
  expect(steps.some((s) => /Action Required|Damage Expected/.test(s))).toBe(false);
});

describe('bodyText', () => {
  it('drops the "Warning Description:" label', () => {
    expect(bodyText('Warning Description: Thundershowers accompanied with severe lightning are likely.'))
      .toBe('Thundershowers accompanied with severe lightning are likely.');
  });
  it('leaves a description without a label as it is', () => {
    expect(bodyText('Heavy rain above 100 mm is likely. Take care: roads may flood.')).toBe('Heavy rain above 100 mm is likely. Take care: roads may flood.');
    expect(bodyText(null)).toBe('');
  });
});

describe('newsTitle', () => {
  const t = (k) => ({ riskLow: 'Low risk', riskMedium: 'Medium risk', riskHigh: 'High risk' })[k] || k;
  it.each([
    ['yellow', 'Heavy Rain', 'Heavy Rain - Low risk'],
    ['amber', 'Thunderstorms', 'Thunderstorms - Medium risk'],
    ['red', 'Cyclone', 'Cyclone - High risk'],
  ])('%s -> risk level, not the colour', (colour, event, want) => {
    const title = newsTitle({ colour, event, headline: `${event} ${colour} Warning (Be Prepared)` }, t);
    expect(title).toBe(want);
    expect(title).not.toMatch(/amber|yellow|red|warning/i);
  });
  it('keeps the feed\'s headline when it names no colour', () => {
    expect(newsTitle({ colour: null, event: 'Fog', headline: 'Fog advisory' }, t)).toBe('Fog advisory');
  });
  it('falls back to the event, then nothing', () => {
    expect(newsTitle({ colour: null, event: 'Fog' }, t)).toBe('Fog');
    expect(newsTitle(null, t)).toBe('');
  });
  it('uses the translated event and risk', () => {
    expect(newsTitle({ colour: 'amber', event: 'மின்னல்' }, (k) => (k === 'riskMedium' ? 'நடுத்தர ஆபத்து' : k))).toBe('மின்னல் - நடுத்தர ஆபத்து');
  });
});
