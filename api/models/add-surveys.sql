-- Disaster and damage assessment surveys sent from the admin portal
CREATE TABLE IF NOT EXISTS surveys (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description     TEXT,
  translations    JSONB NOT NULL DEFAULT '{}'::jsonb,
  category        TEXT NOT NULL DEFAULT 'disaster' CHECK (category IN ('disaster', 'flood', 'drought', 'pest', 'general')),
  target_type     TEXT NOT NULL CHECK (target_type IN ('all', 'district', 'reservoir', 'tank', 'farmers')),
  target_value    JSONB,
  target_label    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by      UUID REFERENCES admins(admin_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_surveys_updated_at ON surveys;
CREATE TRIGGER trg_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS survey_questions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id       BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  position        INT NOT NULL CHECK (position >= 0),
  question_text   TEXT NOT NULL CHECK (length(trim(question_text)) > 0),
  question_type   TEXT NOT NULL CHECK (question_type IN ('choice', 'multi_choice', 'yes_no', 'number', 'text')),
  options         JSONB,
  translations    JSONB NOT NULL DEFAULT '{}'::jsonb,
  required        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_survey_question_pos UNIQUE (survey_id, position)
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions (survey_id, position ASC);

CREATE TABLE IF NOT EXISTS survey_responses (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id       BIGINT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  farmer_id       UUID NOT NULL REFERENCES farmers(farmer_id) ON DELETE CASCADE,
  farm_id         TEXT REFERENCES farmers(farm_id) ON UPDATE CASCADE ON DELETE SET NULL,
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_survey_farmer UNIQUE (survey_id, farmer_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses (survey_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_farmer ON survey_responses (farmer_id);
