// Farmer-facing disaster surveys API
import { useEffect, useState, useCallback, useRef } from 'react';
import { authed } from './auth.js';

const OUTBOX_KEY = 'ym-survey-outbox-v1';
export const SURVEY_OUTBOX_EVENT = 'ym-survey-outbox-changed';
const flushes = new Map();

function outboxStorage() {
  if (typeof localStorage === 'undefined') throw new Error('Offline survey storage is unavailable on this device.');
  return localStorage;
}

function readOutbox() {
  const raw = outboxStorage().getItem(OUTBOX_KEY);
  if (!raw) return [];
  let queue;
  try {
    queue = JSON.parse(raw);
  } catch {
    throw new Error('Saved survey responses could not be read. Do not clear this app’s stored data.');
  }
  if (!Array.isArray(queue) || queue.some((item) => !item?.id || !item.farmerId || !item.surveyId || !item.answers)) {
    throw new Error('Saved survey responses are incomplete and cannot be sent safely.');
  }
  return queue;
}

function notifyOutbox(detail) {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SURVEY_OUTBOX_EVENT, { detail }));
  }
}

function writeOutbox(queue, detail = {}) {
  outboxStorage().setItem(OUTBOX_KEY, JSON.stringify(queue));
  notifyOutbox({ ...detail, pending: queue.length });
}

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;
const matchesSubmission = (item, farmerId, surveyId) =>
  item.farmerId === String(farmerId) && item.surveyId === String(surveyId);

function removeFromOutbox(id, farmerId) {
  const queue = readOutbox();
  writeOutbox(queue.filter((item) => item.id !== id), { farmerId });
}

function enqueueSurveyResponse(farmerId, surveyId, answers) {
  if (!farmerId) throw new Error('Sign in again before saving this survey on your device.');
  const keyFarmerId = String(farmerId);
  const keySurveyId = String(surveyId);
  const queue = readOutbox();
  const existing = queue.find((item) => matchesSubmission(item, keyFarmerId, keySurveyId));
  if (existing) {
    existing.answers = answers;
    existing.queuedAt = Date.now();
    writeOutbox(queue, { farmerId: keyFarmerId, surveyId: keySurveyId });
    return existing;
  }
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    farmerId: keyFarmerId,
    surveyId: keySurveyId,
    answers,
    queuedAt: Date.now(),
  };
  writeOutbox([...queue, entry], { farmerId: keyFarmerId, surveyId: keySurveyId });
  return entry;
}

export function hasQueuedSurvey(farmerId, surveyId) {
  if (!farmerId || !surveyId) return false;
  return readOutbox().some((item) => matchesSubmission(item, farmerId, surveyId));
}

export function queuedSurveyCount(farmerId) {
  if (!farmerId) return 0;
  return readOutbox().filter((item) => item.farmerId === String(farmerId)).length;
}

async function postSurveyResponse(surveyId, answers) {
  const res = await authed(`/api/surveys/${surveyId}/respond`, {
    method: 'POST',
    body: { answers },
  });
  return res.data;
}

export async function fetchActiveSurveys() {
  const res = await authed('/api/surveys/active');
  return res.data || [];
}

export async function submitSurvey(surveyId, answers, farmerId) {
  if (!isOnline()) {
    enqueueSurveyResponse(farmerId, surveyId, answers);
    return { queued: true };
  }
  if (farmerId && hasQueuedSurvey(farmerId, surveyId)) {
    const result = await flushSurveyQueue(farmerId);
    if (hasQueuedSurvey(farmerId, surveyId)) return { queued: true };
    if (result.sent > 0) return { delivered: true };
  }
  try {
    return await postSurveyResponse(surveyId, answers);
  } catch (error) {
    if (error.status === 0 || !isOnline()) {
      enqueueSurveyResponse(farmerId, surveyId, answers);
      return { queued: true };
    }
    throw error;
  }
}

export function flushSurveyQueue(farmerId) {
  if (!farmerId) return Promise.resolve({ sent: 0, pending: 0, error: null });
  const keyFarmerId = String(farmerId);
  if (flushes.has(keyFarmerId)) return flushes.get(keyFarmerId);

  const flush = (async () => {
    let sent = 0;
    let error = null;
    while (isOnline()) {
      const entry = readOutbox().find((item) => item.farmerId === keyFarmerId);
      if (!entry) break;
      try {
        await postSurveyResponse(entry.surveyId, entry.answers);
      } catch (err) {
        if (err.status === 400 && /already submitted/i.test(err.message)) {
          removeFromOutbox(entry.id, keyFarmerId);
          sent += 1;
          continue;
        }
        error = err;
        break;
      }
      removeFromOutbox(entry.id, keyFarmerId);
      sent += 1;
    }
    const pending = queuedSurveyCount(keyFarmerId);
    if (error) notifyOutbox({ farmerId: keyFarmerId, pending, error: error.message });
    return { sent, pending, error };
  })();

  flushes.set(keyFarmerId, flush);
  return flush.finally(() => flushes.delete(keyFarmerId));
}

export function localizedSurvey(survey, language) {
  const surveyTranslation = survey.translations?.[language] || {};
  return {
    ...survey,
    title: surveyTranslation.title || survey.title,
    description: surveyTranslation.description || survey.description,
    questions: (survey.questions || []).map((question) => {
      const translation = question.translations?.[language] || {};
      return {
        ...question,
        question_text: translation.question_text || question.question_text,
        displayOptions: (question.options || []).map((value, index) => ({
          value,
          label: translation.options?.[index] || value,
        })),
      };
    }),
  };
}

export function useActiveSurveys(farmerId) {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(Boolean(farmerId));
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const loaded = useRef(false);

  const reload = useCallback(({ silent = false } = {}) => {
    if (!farmerId) {
      setSurveys([]);
      setLoading(false);
      setError(null);
      loaded.current = false;
      return;
    }
    const currentRequest = ++requestId.current;
    if (!silent || !loaded.current) setLoading(true);
    fetchActiveSurveys()
      .then((list) => {
        if (currentRequest !== requestId.current) return;
        setSurveys(list);
        loaded.current = true;
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (currentRequest !== requestId.current) return;
        setError(err);
        setLoading(false);
      });
  }, [farmerId]);

  useEffect(() => {
    loaded.current = false;
    reload();
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') reload({ silent: true });
    };
    const interval = window.setInterval(refreshIfVisible, 60_000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      requestId.current += 1;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [reload]);

  return { surveys, loading, error, reload };
}
