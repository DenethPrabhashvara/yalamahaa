import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { useApp } from '../state/AppContext.jsx';
import { hasQueuedSurvey, localizedSurvey, submitSurvey, SURVEY_OUTBOX_EVENT } from '../api/surveys.js';

export default function SurveySheet({ survey, open, onClose, onSuccess }) {
  const { t, lang, user } = useApp();
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [queuePending, setQueuePending] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const displaySurvey = survey ? localizedSurvey(survey, lang) : null;

  useEffect(() => {
    if (!survey) return;
    setAnswers({});
    setError(null);
    setSubmitted(false);
    setQueueError(null);
  }, [survey?.id]);

  useEffect(() => {
    if (!survey || !user?.farmerId) {
      setQueuePending(false);
      return undefined;
    }
    const updateQueueState = (event) => {
      if (event?.detail?.farmerId && event.detail.farmerId !== String(user.farmerId)) return;
      try {
        const pending = hasQueuedSurvey(user.farmerId, survey.id);
        setQueuePending(pending);
        if (pending) setSubmitted(true);
        setQueueError(event?.detail?.surveyId === String(survey.id) ? event.detail.error || null : null);
      } catch (queueReadError) {
        setQueueError(queueReadError.message);
      }
    };
    updateQueueState();
    window.addEventListener(SURVEY_OUTBOX_EVENT, updateQueueState);
    return () => window.removeEventListener(SURVEY_OUTBOX_EVENT, updateQueueState);
  }, [survey?.id, user?.farmerId]);

  if (!survey) return null;

  const handleChoice = (qId, option) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }));
    setError(null);
  };

  const handleMultiChoice = (qId, option) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qId]) ? prev[qId] : [];
      const next = current.includes(option)
        ? current.filter((x) => x !== option)
        : [...current, option];
      return { ...prev, [qId]: next };
    });
    setError(null);
  };

  const handleYesNo = (qId, val) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
    setError(null);
  };

  const handleTextChange = (qId, val) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate required questions
    for (const q of displaySurvey.questions || []) {
      const qid = String(q.id);
      const ans = answers[qid];
      if (q.required) {
        if (
          ans === undefined ||
          ans === null ||
          ans === '' ||
          (Array.isArray(ans) && ans.length === 0)
        ) {
          setError(`${t('questionRequired')} (Q${q.position + 1}: ${q.question_text})`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitSurvey(survey.id, answers, user?.farmerId);
      setQueuePending(Boolean(result?.queued));
      setQueueError(null);
      setSubmitting(false);
      setSubmitted(true);
      if (typeof onSuccess === 'function') {
        onSuccess(survey.id);
      }
    } catch (err) {
      setSubmitting(false);
      setError(err.message || 'Submission failed. Please check connection and try again.');
    }
  };

  const handleClose = () => {
    setAnswers({});
    setError(null);
    setSubmitted(false);
    setQueuePending(false);
    setQueueError(null);
    onClose?.();
  };

  return (
    <Sheet open={open} onClose={handleClose} title={displaySurvey.title || t('disasterSurvey')}>
      {submitted ? (
        <div className="col gap16 py20" style={{ textAlign: 'center', alignItems: 'center' }}>
          <div className="icon-tile green big">
            <Icon name="checkCircle" size={36} />
          </div>
          <div>
            <div className="f18 fw600">{queuePending ? t('surveyQueued') : t('surveySubmitted')}</div>
            <div className="f14 muted" style={{ marginTop: 6, lineHeight: 1.4 }}>
              {queuePending
                ? `${t('surveyQueuedSub')}${queueError ? ` ${t('surveyQueueSendError')}: ${queueError}` : ''}`
                : t('surveySubmittedSub')}
            </div>
          </div>
          <button
            type="button"
            className="pill-btn dark big"
            style={{ width: '100%', marginTop: 12 }}
            onClick={handleClose}
          >
            {t('surveyDoneClose')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="col gap16" style={{ marginTop: 10 }}>
          {displaySurvey.description && (
            <div className="survey-desc-banner">
              <Icon name="info" size={18} />
              <div className="f14 lh">{displaySurvey.description}</div>
            </div>
          )}

          {error && (
            <div className="survey-error-banner">
              <Icon name="warn" size={18} />
              <div className="f14 lh">{error}</div>
            </div>
          )}

          <div className="col gap14" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 2 }}>
            {(displaySurvey.questions || []).map((q) => {
              const qid = String(q.id);
              const currentVal = answers[qid];

              return (
                <div key={q.id} className="survey-q-block">
                  <div className="row gap8" style={{ alignItems: 'flex-start' }}>
                    <span className="chip-soft" style={{ height: 24, fontSize: 11, padding: '0 8px', borderRadius: 8, flexShrink: 0 }}>
                      Q{q.position + 1}
                    </span>
                    <div className="f15 fw600 grow lh-tight" style={{ paddingTop: 2 }}>
                      <span>{q.question_text}</span>
                      {q.required && <span className="survey-req-star">*</span>}
                    </div>
                  </div>

                  {q.question_type === 'choice' && (
                    <div className="col gap8">
                      {(q.displayOptions || []).map(({ value, label }) => {
                        const selected = currentVal === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`survey-choice-btn ${selected ? 'is-selected' : ''}`}
                            onClick={() => handleChoice(qid, value)}
                          >
                            <span className={`survey-radio-circle ${selected ? 'checked' : ''}`} />
                            <span className="grow">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === 'multi_choice' && (
                    <div className="col gap8">
                      <div className="f12 muted">{t('selectOptions')}</div>
                      {(q.displayOptions || []).map(({ value, label }) => {
                        const isChecked = Array.isArray(currentVal) && currentVal.includes(value);
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`survey-choice-btn ${isChecked ? 'is-selected' : ''}`}
                            onClick={() => handleMultiChoice(qid, value)}
                          >
                            <span className={`survey-checkbox-box ${isChecked ? 'checked' : ''}`}>
                              {isChecked && <Icon name="check" size={12} stroke={3} />}
                            </span>
                            <span className="grow">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === 'yes_no' && (
                    <div className="row gap10">
                      <button
                        type="button"
                        className={`survey-toggle-btn grow ${currentVal === 'Yes' ? 'is-yes' : ''}`}
                        onClick={() => handleYesNo(qid, 'Yes')}
                      >
                        <Icon name="check" size={16} />
                        {t('yesOption')}
                      </button>
                      <button
                        type="button"
                        className={`survey-toggle-btn grow ${currentVal === 'No' ? 'is-no' : ''}`}
                        onClick={() => handleYesNo(qid, 'No')}
                      >
                        <Icon name="close" size={16} />
                        {t('noOption')}
                      </button>
                    </div>
                  )}

                  {q.question_type === 'number' && (
                    <input
                      type="number"
                      step="any"
                      className="survey-number-input"
                      placeholder="0.0"
                      value={currentVal ?? ''}
                      onChange={(e) => handleTextChange(qid, e.target.value)}
                    />
                  )}

                  {q.question_type === 'text' && (
                    <div className="survey-textarea-box">
                      <textarea
                        rows={3}
                        className="survey-textarea"
                        placeholder="..."
                        value={currentVal ?? ''}
                        onChange={(e) => handleTextChange(qid, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            className="pill-btn dark big"
            disabled={submitting}
            style={{ width: '100%', marginTop: 8 }}
          >
            {submitting ? t('submittingSurvey') : t('surveyCompleteBtn')}
          </button>
        </form>
      )}
    </Sheet>
  );
}
