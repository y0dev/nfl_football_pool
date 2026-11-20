-- Season-bound plans: a Standard purchase (and any add-on pools bought on
-- top of it) covers ONE NFL season, as the Terms already state. Until now
-- commissioners.plan stayed 'standard' forever once bought, so a cheap
-- late-season/playoff purchase silently carried into every future season.
--
-- commissioners.plan_season — the NFL season year (getNFLSeasonYear(): the
--   year the season kicks off; it rolls over on Feb 14) that the current
--   Standard plan covers. computePlanInfo() in src/lib/plan.ts treats a
--   Standard row whose plan_season is older than the current season as
--   Free. NULL = not season-bound (comped accounts, or a row written before
--   this column existed).
-- payments.season — the season a purchase was made for, so revenue can be
--   reported per season and a purchase can be traced to what it granted.

ALTER TABLE commissioners ADD COLUMN IF NOT EXISTS plan_season INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS season INTEGER;

-- Backfill payments by purchase date using the same Feb 14 rollover as
-- getNFLSeasonYear().
UPDATE payments
SET season = CASE
  WHEN created_at < make_timestamptz(EXTRACT(YEAR FROM created_at)::int, 2, 14, 0, 0, 0, 'UTC')
    THEN EXTRACT(YEAR FROM created_at)::int - 1
  ELSE EXTRACT(YEAR FROM created_at)::int
END
WHERE season IS NULL AND created_at IS NOT NULL;

-- Everyone on Standard today keeps it through the end of the current
-- (2026) season — this column is new, so nobody is downgraded mid-season by
-- the migration itself. Comped accounts stay NULL (never expire).
UPDATE commissioners
SET plan_season = 2026
WHERE plan = 'standard'
  AND plan_season IS NULL
  AND COALESCE(billing_exempt, false) = false;
