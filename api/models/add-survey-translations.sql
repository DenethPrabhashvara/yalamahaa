-- Add optional Sinhala and Tamil labels to existing surveys and questions.
ALTER TABLE surveys
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE survey_questions
  ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;
