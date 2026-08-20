-- Survivor Pool support (competition_type = 'SURVIVOR'). Kept entirely
-- separate from picks/scores — those are shaped around per-week
-- confidence_points uniqueness, which doesn't map onto Survivor's
-- season-long "one pick per week, never reuse a team" rules. Two tables:
--
-- survivor_picks: one row per participant per week. Both constraints below
-- are enforced at the database level (not just in the app), per the
-- explicit requirement that the backend be authoritative for both the
-- one-pick-per-week rule and the never-reuse-a-team rule.
--
-- survivor_winners: written exactly once, only when a commissioner
-- explicitly closes a Survivor pool's season (mirrors season_winners' own
-- pattern for Confidence pools) — never cron-cached, and never touched by
-- the live week-by-week ACTIVE/ELIMINATED computation in src/lib/survivor.ts.
-- winner_participant_ids is an array to support the "all remaining
-- participants are winners" end-of-season rule.

CREATE TABLE IF NOT EXISTS public.survivor_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  game_id VARCHAR NOT NULL REFERENCES public.games(id),
  season INTEGER NOT NULL,
  season_type SMALLINT NOT NULL,
  week INTEGER NOT NULL,
  selected_team VARCHAR NOT NULL,
  submitted_by VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT survivor_picks_one_per_week UNIQUE (participant_id, pool_id, season, season_type, week),
  CONSTRAINT survivor_picks_no_team_reuse UNIQUE (participant_id, pool_id, season, selected_team)
);

CREATE INDEX IF NOT EXISTS idx_survivor_picks_pool_week ON public.survivor_picks (pool_id, season, season_type, week);
CREATE INDEX IF NOT EXISTS idx_survivor_picks_participant ON public.survivor_picks (participant_id);
CREATE INDEX IF NOT EXISTS idx_survivor_picks_game ON public.survivor_picks (game_id);

ALTER TABLE public.survivor_picks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage survivor_picks" ON public.survivor_picks
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.survivor_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  winner_participant_ids UUID[] NOT NULL,
  resolution VARCHAR NOT NULL,
  determined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT survivor_winners_pool_season_unique UNIQUE (pool_id, season)
);

ALTER TABLE public.survivor_winners ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage survivor_winners" ON public.survivor_winners
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
