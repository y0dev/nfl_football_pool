-- Manual NFL Data Sync (Super Admin, /admin/nfl-sync) previously wrote
-- straight to `games` on every click with no review step. These two tables
-- back the new preview -> approve/reject -> apply workflow: a sync run
-- fetches from ESPN, diffs against `games`, and persists the proposal here
-- instead of writing games directly. Approval later re-checks
-- base_snapshot against the live games row before applying (staleness
-- guard — see src/app/api/admin/nfl-sync/apply/route.ts).
--
-- The automated background score sync (supabase/functions/update-game-scores)
-- is untouched and keeps writing directly — it only ever updates
-- status/score fields on games that already exist, never creates a game or
-- overwrites a schedule, which is a much narrower blast radius than this
-- admin-triggered full sync.

CREATE TABLE IF NOT EXISTS nfl_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by VARCHAR(255) NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  week INTEGER, -- null = full-season sync
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review', -- pending_review | applied | rejected | failed
  games_checked INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  applied_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  stale_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS nfl_sync_proposed_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id UUID NOT NULL REFERENCES nfl_sync_runs(id) ON DELETE CASCADE,
  external_game_id VARCHAR(255) NOT NULL,
  change_type VARCHAR(20) NOT NULL, -- 'new' | 'updated'
  field_diffs JSONB NOT NULL DEFAULT '{}'::jsonb, -- { field: { old, new } }
  proposed_payload JSONB NOT NULL, -- full row to upsert into games if approved
  base_snapshot JSONB, -- games row (relevant fields) at preview time; null for 'new'
  decision VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected | applied | stale
  decided_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfl_sync_proposed_changes_run ON nfl_sync_proposed_changes(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_nfl_sync_runs_created_at ON nfl_sync_runs(created_at DESC);
