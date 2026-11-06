-- Adds the field size, the field boundary the farmer marks on the map, and the farmer's
-- flood history to farms. Used by the flood model to work out flood risk for each field.
-- Safe to run more than once. Needs add-farms.sql first.
--   psql -d yala-maha-api -f api/models/add-farm-field-flood.sql

BEGIN;

ALTER TABLE farms
  -- all the land as the farmer says, incl. fallow; crop acres can add up to more or less
  ADD COLUMN IF NOT EXISTS total_acres     NUMERIC(10,2),
  -- GeoJSON Polygon, [longitude, latitude], ring closed. NULL = not drawn
  ADD COLUMN IF NOT EXISTS boundary        JSONB,
  -- worked out by the API from boundary, never taken from the app
  ADD COLUMN IF NOT EXISTS boundary_acres  NUMERIC(10,2),
  -- last 5 years, as the farmer remembers. NULL = not asked / skipped
  ADD COLUMN IF NOT EXISTS flood_history   TEXT,
  ADD COLUMN IF NOT EXISTS flood_depth     TEXT,      -- deepest it got; waist = waist or higher
  ADD COLUMN IF NOT EXISTS flood_last_year SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_total_acres_check') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_total_acres_check CHECK (total_acres > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_boundary_check') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_boundary_check CHECK (boundary IS NULL OR boundary->>'type' = 'Polygon');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_boundary_acres_check') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_boundary_acres_check CHECK (boundary_acres > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_flood_history_check') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_flood_history_check
      CHECK (flood_history IN ('never', 'once', 'several', 'unsure'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_flood_depth_check') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_flood_depth_check CHECK (flood_depth IN ('ankle', 'knee', 'waist'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_flood_last_year_check') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_flood_last_year_check CHECK (flood_last_year BETWEEN 1950 AND 2100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_boundary_acres') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_boundary_acres CHECK ((boundary IS NULL) = (boundary_acres IS NULL));
  END IF;
  -- depth and year only when the field did flood
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_flood_details') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_flood_details CHECK (
      COALESCE(flood_history, '') IN ('once', 'several') OR (flood_depth IS NULL AND flood_last_year IS NULL)
    );
  END IF;
END $$;

-- Farmers registered before this are left NULL (not asked yet) rather than copying their crop
-- total in: the flood model falls back to farmers.land_acres itself, and the portal asks them
-- the next time they edit their farm.

COMMIT;
