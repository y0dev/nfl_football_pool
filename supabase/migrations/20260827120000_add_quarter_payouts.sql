-- Adds Quarter (Q1-Q4) payouts alongside the existing Weekly/Overall payout
-- configuration. Same shape as the weekly_* columns — fixed/percentage
-- amount type, an amount, and an ordered positions array — since the
-- calculation formula is identical, just scoped to a quarter instead of a
-- week (see computeQuarterDollarAmount in src/lib/payouts.ts). Quarter
-- payouts are only meaningful for pools that have a quarter/period concept
-- at all (Confidence pools with the regular season in scope — see
-- getRegularSeasonPeriods()/period_winners); other pool types simply never
-- enable quarter_enabled, same as they might never enable weekly_enabled.
ALTER TABLE payout_configs
  ADD COLUMN IF NOT EXISTS quarter_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quarter_amount_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (quarter_amount_type IN ('fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS quarter_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS quarter_positions JSONB NOT NULL DEFAULT '[{"place":1,"percentage":100}]'::jsonb;

-- payout_records needs a way to distinguish Q1 vs Q2 vs Q3 vs Q4 within the
-- same (pool, season) — weekly rows already use `week` for this, overall
-- rows use week=0 as a "not applicable" sentinel (see
-- 20260815180000_add_payout_configuration.sql). Quarter rows reuse that same
-- week=0 sentinel convention and add period_name ('Q1'..'Q4') as the actual
-- discriminator, mirroring how src/lib/utils.ts's getRegularSeasonPeriods()
-- names periods elsewhere in the app.
ALTER TABLE payout_records ADD COLUMN IF NOT EXISTS period_name TEXT;

ALTER TABLE payout_records DROP CONSTRAINT IF EXISTS payout_records_scope_check;
ALTER TABLE payout_records ADD CONSTRAINT payout_records_scope_check
  CHECK (scope IN ('weekly', 'overall', 'quarter'));

-- Replaces the per-participant uniqueness fixed in
-- 20260815190000_fix_payout_records_tie_uniqueness.sql with an equivalent
-- constraint that also discriminates on period_name. NULL-for-weekly/overall
-- rows is unaffected: those rows already differ on `week`/scope, so adding
-- an always-NULL column to the key changes nothing for them (Postgres never
-- treats two NULLs as equal in a unique index, but weekly/overall rows never
-- relied on period_name to be distinct from each other in the first place).
ALTER TABLE payout_records
  DROP CONSTRAINT IF EXISTS payout_records_pool_id_scope_season_week_participant_id_key;
ALTER TABLE payout_records
  ADD CONSTRAINT payout_records_pool_scope_season_week_period_participant_key
  UNIQUE (pool_id, scope, season, week, period_name, participant_id);
