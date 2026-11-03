-- Official weather warnings from the Department of Meteorology CAP feed
-- (services/weatherFeedJob.js -> models/newsModel.js -> the farmer portal's news section).
-- Safe to run more than once.

-- app_settings already exists if add-flood-auto-alerts.sql has been run; repeated here so
-- this migration stands alone.
CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES admins(admin_id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Lets the feed be switched off from the admin portal, like flood_auto_alerts.
INSERT INTO app_settings (key, value) VALUES ('weather_feed', 'true') ON CONFLICT (key) DO NOTHING;

-- One row per CAP alert. Everything here is language-invariant and every classification
-- column is derived from the ENGLISH file, so the red banner can never depend on matching
-- Sinhala or Tamil text. Translated text lives in weather_advisory_texts.
CREATE TABLE IF NOT EXISTS weather_advisories (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier    TEXT NOT NULL UNIQUE,            -- CAP <identifier>
  -- The feed's own file id from the RSS guid. Lets a poll skip an alert it already holds
  -- without downloading the file first, since <identifier> only exists inside the file.
  -- NULL for rows not from the feed (e.g. the test cyclone below).
  feed_id       TEXT UNIQUE,
  sender        TEXT,
  sent          TIMESTAMPTZ NOT NULL,
  expires       TIMESTAMPTZ,
  status        TEXT,                            -- Actual / Exercise / Test
  msg_type      TEXT,                            -- Alert / Update / Cancel
  scope         TEXT,                            -- Public
  category      TEXT,                            -- Met
  event         TEXT NOT NULL,                   -- English, e.g. Lightning / Cyclone
  response_type TEXT,
  urgency       TEXT,
  severity      TEXT,                            -- Extreme / Severe / Moderate / Minor
  certainty     TEXT,
  colour        TEXT NOT NULL DEFAULT 'none' CHECK (colour IN ('red','amber','yellow','none')),
  is_cyclone    BOOLEAN NOT NULL DEFAULT FALSE,
  banner        BOOLEAN NOT NULL DEFAULT FALSE,  -- earns the red banner on the home screen
  tone          TEXT NOT NULL DEFAULT 'soft' CHECK (tone IN ('red','amber','blue','soft')),
  districts     TEXT[] NOT NULL DEFAULT '{}',    -- canonical names, matched to farmers.district
  divisions     TEXT[] NOT NULL DEFAULT '{}',    -- display only, never used to exclude
  all_island    BOOLEAN NOT NULL DEFAULT FALSE,
  web           TEXT,
  -- 'metdept' today. The extension point for officer-written notices later.
  source        TEXT NOT NULL DEFAULT 'metdept',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The feed's own translations, one row per language we managed to fetch.
CREATE TABLE IF NOT EXISTS weather_advisory_texts (
  advisory_id  BIGINT NOT NULL REFERENCES weather_advisories(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL CHECK (lang IN ('en','si','ta')),
  event        TEXT,
  headline     TEXT,
  description  TEXT,
  instruction  TEXT,
  area_desc    TEXT,
  PRIMARY KEY (advisory_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_weather_advisories_live ON weather_advisories (expires DESC NULLS LAST, sent DESC);
CREATE INDEX IF NOT EXISTS idx_weather_advisories_districts ON weather_advisories USING GIN (districts);
CREATE INDEX IF NOT EXISTS idx_weather_advisory_texts_lang ON weather_advisory_texts (lang);

-- set_updated_at() is defined in schema.sql
DROP TRIGGER IF EXISTS trg_weather_advisories_updated_at ON weather_advisories;
CREATE TRIGGER trg_weather_advisories_updated_at
  BEFORE UPDATE ON weather_advisories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Testing a cyclone without waiting for one. Run both inserts, set your test farmer's
-- district to Polonnaruwa, and hard-reload the portal: the red banner must appear above
-- the home header and the item must show in /alerts.
--
-- INSERT INTO weather_advisories
--   (identifier, sender, sent, expires, status, msg_type, scope, event, category,
--    response_type, urgency, severity, certainty, colour, is_cyclone, banner, tone,
--    districts, divisions, all_island, web, source)
-- VALUES ('TEST-CYCLONE-1','test@local', now(), now() + interval '18 hours',
--    'Actual','Alert','Public','Cyclone','Met','Prepare','Immediate','Extreme','Likely',
--    'red', true, true, 'red', ARRAY['Polonnaruwa','Batticaloa'], ARRAY['Hingurakgoda'], false,
--    'https://was.meteo.gov.lk','metdept');
--
-- INSERT INTO weather_advisory_texts (advisory_id, lang, event, headline, description, instruction, area_desc)
-- SELECT id, 'en', 'Cyclone', 'Cyclone Red Warning (Take Action)',
--        'A tropical cyclone is expected to cross the east coast within 18 hours.',
--        E'Move livestock and pumps to high ground\nSecure or harvest ready crops\nStay away from canals and bunds',
--        'Districts: POLONNARUWA, BATTICALOA'
-- FROM weather_advisories WHERE identifier = 'TEST-CYCLONE-1';
--
-- Then, to check it disappears:
--   UPDATE weather_advisories SET expires = now() - interval '1 minute' WHERE identifier = 'TEST-CYCLONE-1';
-- And to clean up:
--   DELETE FROM weather_advisories WHERE identifier LIKE 'TEST-%';
-- ---------------------------------------------------------------------------
