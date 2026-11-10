import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authed } from '../src/api/auth.js';
import {
  flushSurveyQueue,
  hasQueuedSurvey,
  localizedSurvey,
  queuedSurveyCount,
  submitSurvey,
} from '../src/api/surveys.js';
import { SURVEY_TEMPLATES } from '../../adminportal/src/data/surveys.js';

vi.mock('../src/api/auth.js', () => ({ authed: vi.fn() }));

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

function setOnline(online) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: online },
  });
}

describe('disaster survey translations', () => {
  it('pre-populates every disaster template question and choice in Sinhala and Tamil', () => {
    for (const template of SURVEY_TEMPLATES.filter((item) => item.id !== 'custom')) {
      for (const language of ['si', 'ta']) {
        expect(template.translations[language].title).toBeTruthy();
        expect(template.translations[language].description).toBeTruthy();
        for (const question of template.questions) {
          expect(question.translations[language].question_text).toBeTruthy();
          if (question.options) {
            expect(question.translations[language].options).toHaveLength(question.options.length);
            expect(question.translations[language].options.every(Boolean)).toBe(true);
          }
        }
      }
    }
  });

  it('localizes survey labels while preserving canonical English values for answers', () => {
    const [question] = localizedSurvey({
      title: 'Flood survey',
      description: 'English details',
      translations: { ta: { title: 'வெள்ளக் கணக்கெடுப்பு', description: 'வயல் நிலை' } },
      questions: [{
        id: 1,
        question_text: 'Is your field flooded?',
        question_type: 'choice',
        options: ['Yes', 'No'],
        translations: { ta: { question_text: 'உங்கள் வயல் நீரில் மூழ்கியுள்ளதா?', options: ['ஆம்', 'இல்லை'] } },
      }],
    }, 'ta').questions;

    expect(question.question_text).toBe('உங்கள் வயல் நீரில் மூழ்கியுள்ளதா?');
    expect(question.displayOptions).toEqual([
      { value: 'Yes', label: 'ஆம்' },
      { value: 'No', label: 'இல்லை' },
    ]);
  });
});

describe('offline survey outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage = makeStorage();
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it('saves offline submissions for the signed-in farmer and sends them when online', async () => {
    setOnline(false);
    await expect(submitSurvey(12, { '4': 'Yes' }, 'farmer-a')).resolves.toEqual({ queued: true });
    expect(authed).not.toHaveBeenCalled();
    expect(hasQueuedSurvey('farmer-a', 12)).toBe(true);
    expect(queuedSurveyCount('farmer-a')).toBe(1);
    expect(queuedSurveyCount('farmer-b')).toBe(0);

    setOnline(true);
    authed.mockResolvedValue({ data: { id: 81 } });
    await expect(flushSurveyQueue('farmer-a')).resolves.toMatchObject({ sent: 1, pending: 0, error: null });
    expect(authed).toHaveBeenCalledWith('/api/surveys/12/respond', {
      method: 'POST',
      body: { answers: { '4': 'Yes' } },
    });
    expect(hasQueuedSurvey('farmer-a', 12)).toBe(false);
  });

  it('keeps network-failed queued responses for retry', async () => {
    setOnline(false);
    await submitSurvey(5, { '1': 'No' }, 'farmer-a');
    setOnline(true);
    authed.mockRejectedValueOnce(Object.assign(new Error('Cannot reach the server'), { status: 0 }));

    const result = await flushSurveyQueue('farmer-a');
    expect(result.pending).toBe(1);
    expect(result.error.message).toBe('Cannot reach the server');
    expect(hasQueuedSurvey('farmer-a', 5)).toBe(true);
  });

  it('flushes an existing queued answer instead of posting a duplicate', async () => {
    setOnline(false);
    await submitSurvey(5, { '1': 'No' }, 'farmer-a');
    setOnline(true);
    authed.mockResolvedValue({ data: { id: 81 } });

    await expect(submitSurvey(5, { '1': 'Yes' }, 'farmer-a')).resolves.toEqual({ delivered: true });
    expect(authed).toHaveBeenCalledTimes(1);
    expect(hasQueuedSurvey('farmer-a', 5)).toBe(false);
  });

  it('does not discard a response rejected for a non-network reason', async () => {
    setOnline(false);
    await submitSurvey(5, { '1': 'No' }, 'farmer-a');
    setOnline(true);
    authed.mockRejectedValueOnce(Object.assign(new Error('Survey is closed'), { status: 400 }));

    const result = await flushSurveyQueue('farmer-a');
    expect(result.pending).toBe(1);
    expect(result.error.message).toBe('Survey is closed');
  });

  it('removes a response after the server confirms it was already submitted', async () => {
    setOnline(false);
    await submitSurvey(5, { '1': 'No' }, 'farmer-a');
    setOnline(true);
    authed.mockRejectedValueOnce(Object.assign(new Error('You have already submitted a response to this survey.'), { status: 400 }));

    await expect(flushSurveyQueue('farmer-a')).resolves.toMatchObject({ sent: 1, pending: 0, error: null });
    expect(hasQueuedSurvey('farmer-a', 5)).toBe(false);
  });
});
