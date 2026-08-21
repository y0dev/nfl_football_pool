-- Pick'em Pool support (competition_type = 'PICKEM'). Kept entirely
-- separate from Confidence's `picks` table (which requires a NOT NULL
-- confidence_points on every row — Pick'em has no confidence points at all)
-- and from Survivor's tables. Two tables:
--
-- pickem_picks: one row per participant per game (not per week) — a
-- participant picks a winner for every eligible game independently, and
-- each game can be locked/changed independently of the rest of the week
-- once its own kickoff passes. UNIQUE per (participant, pool, game) so a
-- pick can be updated (upsert) up until that specific game locks.
--
-- pickem_tiebreakers: one row per participant per week — the "predict the
-- combined score of the tiebreaker game" entry described in
-- src/lib/pickem.ts. Deliberately not reusing Confidence's `tie_breakers`
-- table: that table is admin-override-driven (commissioner enters the
-- score on a participant's behalf) and carries Confidence-only resolution
-- columns (is_winner, rank, tie_breaker_used, tie_breaker_rank) that
-- Pick'em has no use for and shouldn't risk being conflated with.

CREATE TABLE IF NOT EXISTS public.pickem_picks (
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
  CONSTRAINT pickem_picks_one_per_game UNIQUE (participant_id, pool_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_pickem_picks_pool_week ON public.pickem_picks (pool_id, season, season_type, week);
CREATE INDEX IF NOT EXISTS idx_pickem_picks_participant ON public.pickem_picks (participant_id);
CREATE INDEX IF NOT EXISTS idx_pickem_picks_game ON public.pickem_picks (game_id);

ALTER TABLE public.pickem_picks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage pickem_picks" ON public.pickem_picks
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.pickem_tiebreakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  game_id VARCHAR NOT NULL REFERENCES public.games(id),
  season INTEGER NOT NULL,
  season_type SMALLINT NOT NULL,
  week INTEGER NOT NULL,
  predicted_total INTEGER NOT NULL,
  submitted_by VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pickem_tiebreakers_one_per_week UNIQUE (participant_id, pool_id, season, season_type, week)
);

CREATE INDEX IF NOT EXISTS idx_pickem_tiebreakers_pool_week ON public.pickem_tiebreakers (pool_id, season, season_type, week);

ALTER TABLE public.pickem_tiebreakers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage pickem_tiebreakers" ON public.pickem_tiebreakers
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
