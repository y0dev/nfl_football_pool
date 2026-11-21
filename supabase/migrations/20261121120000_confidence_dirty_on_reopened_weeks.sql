-- Schedule changes that reopen a finalized week must reach the Confidence
-- dirty-results pipeline.
--
-- 20261119140000 left one gap on purpose: inserting an UNFINISHED game
-- marked nothing, because incomplete weeks kept their recorded results. A
-- newly scheduled game in an already-finalized week now reopens that week:
-- planResultWrites() (supabase/functions/_shared/confidence-results.ts)
-- withdraws its stored weekly winner (and the quarter and season winners
-- that depended on it) until the new game is final. That only happens if
-- the pool gets recomputed, so the insert has to mark it.
--
-- Only inserts into a week that already has a finished game mark pools —
-- loading a future week's schedule marks nothing. Moving an unfinished game
-- into another week already marks (20261119140000).

CREATE OR REPLACE FUNCTION public.mark_confidence_results_dirty_from_games()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seasons integer[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.confidence_game_is_finished(NEW.winner, NEW.status)
       AND NOT EXISTS (
         SELECT 1 FROM public.games g
         WHERE g.season = NEW.season
           AND g.season_type IS NOT DISTINCT FROM NEW.season_type
           AND g.week = NEW.week
           AND g.id <> NEW.id
           AND public.confidence_game_is_finished(g.winner, g.status)
       ) THEN
      RETURN NULL; -- a future week's schedule: nothing to recompute yet
    END IF;
    v_seasons := ARRAY[NEW.season];
  ELSIF TG_OP = 'DELETE' THEN
    v_seasons := ARRAY[OLD.season];
  ELSE
    IF NOT public.confidence_game_is_finished(OLD.winner, OLD.status)
       AND NOT public.confidence_game_is_finished(NEW.winner, NEW.status)
       AND OLD.week IS NOT DISTINCT FROM NEW.week
       AND OLD.season IS NOT DISTINCT FROM NEW.season
       AND OLD.season_type IS NOT DISTINCT FROM NEW.season_type THEN
      RETURN NULL; -- live-score churn on an unfinished game
    END IF;
    v_seasons := ARRAY[OLD.season, NEW.season];
  END IF;

  PERFORM public.mark_confidence_pools_dirty(array_agg(p.id))
  FROM public.pools p
  WHERE p.season = ANY (v_seasons)
    AND p.is_active = true
    AND coalesce(p.competition_type, 'NFL_CONFIDENCE') IN ('NFL_CONFIDENCE', 'NCAA_CONFIDENCE');
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_confidence_results_dirty_from_games() FROM PUBLIC, anon, authenticated;
