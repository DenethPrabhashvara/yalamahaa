-- Persist each farmer's SMS language and ensure the precomputed DEM risk table exists.
-- Safe to run repeatedly. Existing farmers default to English until they choose a language.
BEGIN;

ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS preferred_lang TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farmers_preferred_lang_check') THEN
    ALTER TABLE farmers
      ADD CONSTRAINT farmers_preferred_lang_check CHECK (preferred_lang IN ('en', 'si', 'ta'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS farm_flood_risk (
  farm_id          TEXT PRIMARY KEY REFERENCES farmers(farm_id) ON UPDATE CASCADE ON DELETE CASCADE,
  score            SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
  category         TEXT NOT NULL CHECK (category IN ('very_low', 'low', 'medium', 'high', 'very_high')),
  elevation_m      DOUBLE PRECISION,
  elevation_from   TEXT,
  river_name       TEXT,
  river_distance_m INT,
  rise_needed_m    DOUBLE PRECISION,
  rivers           JSONB NOT NULL,
  farm_latitude    NUMERIC(10,6) NOT NULL,
  farm_longitude   NUMERIC(10,6) NOT NULL,
  boundary         JSONB,
  method           TEXT NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
