-- Adds season_settings: the admin-editable, DB-backed source of truth for
-- season phase boundaries — replaces values previously kept only in source
-- (start of preseason/regular season/postseason, current week, whether the
-- season is over). Backs src/lib/seasonSettings.ts and the pool-creation
-- phase gating in src/lib/plan.ts (checkSeasonScopeCreatable) — e.g.
-- refusing to create a preseason-scoped pool once preseason's last week has
-- started.
--
-- One row per season year. Run this in the Supabase SQL editor. Safe to
-- re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS season_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season INTEGER NOT NULL UNIQUE,
  preseason_start_date DATE,
  regular_season_start_date DATE,
  postseason_start_date DATE,
  current_week INTEGER NOT NULL DEFAULT 1,
  -- 0=offseason, 1=preseason, 2=regular season, 3=postseason — same
  -- convention as games.season_type. current_week is relative to this
  -- phase (e.g. current_week=4 with current_season_type=1 means
  -- preseason week 4, not the 4th week of the whole season).
  current_season_type INTEGER NOT NULL DEFAULT 0,
  season_over BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE season_settings ADD CONSTRAINT season_settings_season_type_check
    CHECK (current_season_type IN (0, 1, 2, 3));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE season_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage season settings" ON season_settings
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
