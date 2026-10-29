#!/usr/bin/env python3
"""Add estimated (made-up) daily readings so reservoirs and tanks with missing data can be forecast.

The forecast (ml-model/server.js) fills up to MAX_FILL_GAP missing days in a row itself, then
needs 15 days of readings. Only a reservoir or Mahaweli tank it would still refuse, or whose
newest reading is over STALE_DAYS old, gets the missing days of the last --days days (up to
yesterday) filled in from the pattern of the tanks that do have readings:

  - each day it moves by the median daily change (as a share of capacity) of the real tanks of
    the same type, starting from its own newest real reading before the gap
  - a gap with a real reading after it is bent so it ends on that reading
  - a tank with no readings at all starts at the median fill of the real tanks of the same type

These are NOT measurements, so they go in their own table, estimated_readings, which only the
forecast reads (api/models/forecastModel.js). It uses an estimate only for a day with no real
reading, and lists those days as estimated_dates so the portals can say so. reservoir_levels and
mahaweli_water_level are never changed. Only names the forecast model knows
(ml-model/model/meta.json) are filled.

  py add-synthetic-readings.py            show what would be added, change nothing
  py add-synthetic-readings.py --apply    add the estimates (and refresh earlier ones)
  py add-synthetic-readings.py --remove   delete every estimate
Database settings come from DB_* / APIDB* environment variables, or else API/config.env.
"""
import argparse
import json
import os
import re
import statistics
import sys
from datetime import date, timedelta
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

HERE = Path(__file__).resolve().parent
CONFIG_ENV = HERE.parent / "API" / "config.env"
MODEL_META = HERE.parent / "ml-model" / "model" / "meta.json"
MIN_REAL = 15     # the forecast needs 15 days of readings
MAX_FILL_GAP = 10 # missing days in a row the forecast fills itself (server.js)
STALE_DAYS = 7    # newest real reading older than this: fill up to yesterday
LOOKBACK = 120   # days of real readings read for the pattern and the starting points
ONE_DAY = timedelta(days=1)
ACFT_PER_MCM = 810.713

# kind 'reservoir': ref_id is reservoirs.id; kind 'mahaweli': ref_id is mahawelitanks.id
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS estimated_readings (
  kind          TEXT NOT NULL CHECK (kind IN ('reservoir', 'mahaweli')),
  ref_id        INT NOT NULL,
  reading_date  DATE NOT NULL,
  storage_acft  NUMERIC NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, ref_id, reading_date)
);
"""


def read_config_env():
    values = {}
    if CONFIG_ENV.exists():
        for line in CONFIG_ENV.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$", line)
            if m:
                values[m.group(1)] = m.group(2).strip()
    return values


def db_config():
    cfg = read_config_env()

    def pick(*names, default=None):
        for name in names:
            if os.getenv(name):
                return os.getenv(name)
        for name in names:
            if cfg.get(name):
                return cfg[name]
        return default

    return {
        "host": pick("APIDBHOST", "DB_HOST", default="localhost"),
        "port": int(pick("APIDBPORT", "DB_PORT", default="5432")),
        "dbname": pick("APIDATABASE", "DB_NAME", default="yala-maha-api"),
        "user": pick("APIDBUSERN", "DB_USER", default="postgres"),
        "password": pick("APIDBPASSWORD", "DB_PASSWORD", default=""),
    }


def build_pattern(series, days):
    """Median daily change and median fill (shares of capacity) over the real series, per day."""
    change, fill = {}, {}
    for d in days:
        steps = [s["real"][d] - s["real"][d - ONE_DAY] for s in series if d in s["real"] and d - ONE_DAY in s["real"]]
        levels = [s["real"][d] for s in series if d in s["real"]]
        if steps:
            change[d] = statistics.median(steps)
        if levels:
            fill[d] = statistics.median(levels)
    return change, fill


def cannot_forecast(days, today):
    """Why the forecast would refuse (or be stale for) a tank with readings on these days, else None.

    Same rule as ml-model/server.js: readings from the last 90 days, runs of up to MAX_FILL_GAP
    missing days are filled, and the 15 days up to the newest reading must then be complete.
    """
    recent = sorted(d for d in days if d >= today - timedelta(days=90))
    if not recent:
        return "no readings in 90 days"
    newest = recent[-1]
    if newest < today - timedelta(days=STALE_DAYS):
        return f"newest reading is {newest}"
    if (newest - recent[0]).days < MIN_REAL - 1:
        return f"only {(newest - recent[0]).days + 1} days of readings"
    start = newest - timedelta(days=MIN_REAL - 1)
    for a, b in zip(recent, recent[1:]):
        if b > start and (b - a).days - 1 > MAX_FILL_GAP:
            return f"{(b - a).days - 1} days missing before {b}"
    return None


def missing_runs(window, real):
    runs, run = [], []
    for d in window:
        if d in real:
            if run:
                runs.append(run)
            run = []
        else:
            run.append(d)
    if run:
        runs.append(run)
    return runs


def estimate(real, window, change_at, start_fill):
    """Fill every day of window that has no real reading, from the pattern. Returns {date: share}."""
    out = {}
    for run in missing_runs(window, real):
        first, last = run[0], run[-1]
        before = max((d for d in real if d < first), default=None)
        after = min((d for d in real if d > last), default=None)
        path = {}
        if before is not None:
            # walk forward from the reading before the gap, up to the reading after it if there is one
            v, d = real[before], before
            while d < (after or last):
                d += ONE_DAY
                v += change_at(d)
                path[d] = v
            if after is not None:
                miss, span = real[after] - path[after], (after - before).days
                path = {d: v + miss * (d - before).days / span for d, v in path.items()}
        elif after is not None:
            v, d = real[after], after
            while d > first:
                v -= change_at(d)
                d -= ONE_DAY
                path[d] = v
        else:
            v, d = start_fill, first
            path[d] = v
            while d < last:
                d += ONE_DAY
                v += change_at(d)
                path[d] = v
        for d in run:
            out[d] = min(1.0, max(0.0, path[d]))
    return out


def load_series(cur, since):
    """Reservoirs and unlinked Mahaweli tanks, each with its real readings as shares of capacity."""
    series = []
    cur.execute("SELECT id, name, type, active_capacity_acft FROM reservoirs")
    reservoirs = {rid: {"kind": "reservoir", "id": rid, "name": name, "group": (kind or "").strip().lower(),
                        "cap": float(cap) if cap else None, "real": {}}
                  for rid, name, kind, cap in cur.fetchall()}
    cur.execute(
        """SELECT reservoir_id, reading_date, usable_storage_acft FROM reservoir_levels
           WHERE reading_date >= %s AND usable_storage_acft IS NOT NULL""",
        [since],
    )
    for rid, day, storage in cur.fetchall():
        s = reservoirs.get(rid)
        if s and s["cap"]:
            s["real"][day] = float(storage) / s["cap"]
    series += reservoirs.values()

    # A Mahaweli tank linked to a reservoir is forecast from the reservoir's readings
    cur.execute("""SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'mahawelitanks' AND column_name = 'reservoir_id'""")
    linked = "reservoir_id IS NULL" if cur.fetchone() else "TRUE"
    cur.execute(f"SELECT id, tank_name, tot_capacity_mcm FROM mahawelitanks WHERE {linked}")
    tanks = {tid: {"kind": "mahaweli", "id": tid, "name": name, "group": "mahaweli",
                   "cap": float(cap) if cap else None, "real": {}}
             for tid, name, cap in cur.fetchall()}
    cur.execute(
        """SELECT tank_id, reading_date, storage_mcm FROM mahaweli_water_level
           WHERE reading_date >= %s AND storage_mcm IS NOT NULL""",
        [since],
    )
    for tid, day, storage in cur.fetchall():
        s = tanks.get(tid)
        if s and s["cap"]:
            s["real"][day] = float(storage) / s["cap"]
    series += tanks.values()
    return series


def save(cur, s, values):
    # Effective storage in ac-ft, what the forecast reads; a Mahaweli tank's capacity is in MCM
    to_acft = s["cap"] * (ACFT_PER_MCM if s["kind"] == "mahaweli" else 1)
    rows = [(s["kind"], s["id"], d, round(v * to_acft, 1)) for d, v in values.items()]
    return len(execute_values(
        cur,
        """INSERT INTO estimated_readings (kind, ref_id, reading_date, storage_acft)
           VALUES %s
           ON CONFLICT (kind, ref_id, reading_date) DO UPDATE SET
             storage_acft = EXCLUDED.storage_acft, created_at = now()
           RETURNING 1""",
        rows, fetch=True,
    ))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=MIN_REAL,
                        help=f"Fill missing days in the last N days up to yesterday (default and minimum {MIN_REAL})")
    parser.add_argument("--apply", action="store_true", help="Save the estimated rows (default: only show them)")
    parser.add_argument("--remove", action="store_true", help="Delete every estimated row and exit")
    args = parser.parse_args()
    if args.days < MIN_REAL:
        sys.exit(f"--days must be at least {MIN_REAL}, the forecast needs that many days.")

    model_tanks = set(json.loads(MODEL_META.read_text(encoding="utf-8"))["tanks"])
    today = date.today()
    window = [today - timedelta(days=args.days - i) for i in range(args.days)]  # ends yesterday
    pattern_days = [today - timedelta(days=LOOKBACK - i) for i in range(LOOKBACK + 1)]

    conn = psycopg2.connect(**db_config())
    try:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
            if args.remove:
                cur.execute("DELETE FROM estimated_readings")
                conn.commit()
                print(f"Deleted {cur.rowcount} estimated readings.")
                return 0

            series = load_series(cur, today - timedelta(days=LOOKBACK))
            with_data = [s for s in series if s["real"]]
            overall = build_pattern(with_data, pattern_days)
            patterns = {g: build_pattern([s for s in with_data if s["group"] == g], pattern_days)
                        for g in {s["group"] for s in series}}

            filled, no_model, no_capacity, no_pattern, added = [], [], [], [], 0
            for s in sorted(series, key=lambda s: s["name"]):
                reason = cannot_forecast(s["real"], today)
                if reason is None:
                    continue
                real_in_window = sum(1 for d in window if d in s["real"])
                newest = max(s["real"], default=None)
                if s["name"] not in model_tanks:
                    no_model.append(s["name"])
                    continue
                if not s["cap"]:
                    no_capacity.append(s["name"])
                    continue

                change, fill = patterns[s["group"]]
                change_at = lambda d: change.get(d, overall[0].get(d, 0.0))  # noqa: E731
                fills = [fill.get(d, overall[1].get(d)) for d in window]
                fills = [f for f in fills if f is not None]
                if not s["real"] and not fills:
                    no_pattern.append(s["name"])
                    continue
                values = estimate(s["real"], window, change_at, statistics.median(fills) if fills else 0.0)
                added += save(cur, s, values)
                last = values[max(values)] if values else None
                filled.append((s["name"], real_in_window, newest, len(values), last, reason))

            print(f"{'Reservoir / tank':<30} {'real days':>9} {'newest real':>12} {'estimated':>9} {'est. now':>8}  why")
            for name, real_n, newest, est_n, last, reason in filled:
                print(f"{name[:30]:<30} {real_n:>9} {str(newest or '-'):>12} {est_n:>9} "
                      f"{'-' if last is None else f'{last * 100:.1f}%':>8}  {reason}")
            print(f"\n{len(filled)} reservoirs/tanks, {sum(f[3] for f in filled)} estimated days "
                  f"({window[0]} to {window[-1]}).")
            if no_model:
                print(f"Skipped, the forecast model doesn't know them (estimates wouldn't help): {', '.join(no_model)}")
            if no_capacity:
                print(f"Skipped, no capacity to scale by: {', '.join(no_capacity)}")
            if no_pattern:
                print(f"Skipped, no tank has readings in this period to copy: {', '.join(no_pattern)}")

            if args.apply:
                conn.commit()
                print(f"Saved {added} estimated readings to estimated_readings. Undo with --remove.")
            else:
                conn.rollback()
                print("Nothing saved. Run again with --apply to add these estimated readings.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
