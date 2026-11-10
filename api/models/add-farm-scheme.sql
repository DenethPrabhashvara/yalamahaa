-- Adds the irrigation scheme the farm pin falls in, from the Irrigation Department's
-- "Irrigable area" map layer (services/schemeJob.js fills it in).
-- scheme_irrigable_ha is the whole scheme's command area (e.g. Minneriya 9,096 ha), shared by
-- every farmer in it. It is NOT the farmer's land: that is total_acres / boundary_acres.
-- Safe to run more than once. Needs add-farms.sql first.
--   psql -d yala-maha-api -f api/models/add-farm-scheme.sql

BEGIN;

ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS scheme_name         TEXT,            -- e.g. Minneriya. NULL = pin not in any mapped scheme
  ADD COLUMN IF NOT EXISTS scheme_type         TEXT,            -- Major / Medium / Minor, as the Irrigation Department has it
  ADD COLUMN IF NOT EXISTS scheme_division     TEXT,            -- Irrigation Department division
  ADD COLUMN IF NOT EXISTS scheme_irrigable_ha NUMERIC(10,2),   -- irrigable area in the scheme register, hectares
  -- 0 = pin inside one of the scheme's paddy tracts; else metres to the nearest one (at most 300)
  ADD COLUMN IF NOT EXISTS scheme_distance_m   INT,
  -- the pin the scheme was looked up for, so a moved pin gets looked up again. NULL = not looked up yet
  ADD COLUMN IF NOT EXISTS scheme_checked_lat  NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS scheme_checked_lng  NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS scheme_checked_at   TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'farms_scheme_irrigable_ha_check') THEN
    ALTER TABLE farms ADD CONSTRAINT farms_scheme_irrigable_ha_check CHECK (scheme_irrigable_ha > 0);
  END IF;
END $$;

COMMIT;
