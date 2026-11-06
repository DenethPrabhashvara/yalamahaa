-- Automatic warning voice calls (services/stormCallJob.js): storms from the weather forecast and
-- tanks the ML model expects to spill. Safe to run more than once.

CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES admins(admin_id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_settings (key, value) VALUES ('storm_calls', 'true') ON CONFLICT (key) DO NOTHING;

-- One row per farmer per alert.
-- alert_key: weather:<storm's first day>  or  ml:<reservoir|tank>:<id>:<model's target date>
-- status: dry_run | skipped_trial | outside_hours  -> only a record, a later real run may still call
--         calling -> being placed now;  called -> Twilio accepted it;  failed -> retried up to 3 attempts
CREATE TABLE IF NOT EXISTS storm_calls (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  farmer_id      UUID NOT NULL REFERENCES farmers(farmer_id) ON DELETE CASCADE,
  phone          TEXT NOT NULL,
  source         TEXT NOT NULL CHECK (source IN ('weather','ml')),
  alert_key      TEXT NOT NULL,
  subject        TEXT,                            -- tank / reservoir name for ml
  event_date     DATE NOT NULL,                   -- storm's first day, or the tank forecast's target date
  event_end      DATE NOT NULL,
  kinds          TEXT[] NOT NULL,                 -- rain, wind, spill
  max_rain_mm    NUMERIC(6,1),
  max_gust_kmh   NUMERIC(6,1),
  predicted_pct  NUMERIC(6,1),                    -- ml: predicted fill
  lead_days      SMALLINT,
  mode           TEXT NOT NULL,                   -- dry-run / trial / live
  lang           TEXT,                            -- si / en / si+en, as actually played
  status         TEXT NOT NULL CHECK (status IN ('dry_run','skipped_trial','outside_hours','calling','called','failed')),
  call_sid       TEXT,
  error          TEXT,
  attempts       SMALLINT NOT NULL DEFAULT 0,
  called_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farmer_id, alert_key)
);
CREATE INDEX IF NOT EXISTS idx_storm_calls_recent ON storm_calls (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_storm_calls_farmer ON storm_calls (farmer_id, status);
