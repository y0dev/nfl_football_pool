-- Schedule corrections must reach the Confidence dirty-results pipeline.
--
-- Weekly/period/season results are written only for weeks whose games are
-- all finished (planResultWrites in
-- supabase/functions/_shared/confidence-results.ts). The original games
-- trigger only fired when a FINISHED game changed, which missed:
--
--   * DELETE — no trigger at all. Removing a finished game (e.g. a duplicate
--     row) left its points in stored scores; removing an unfinished one
--     (a cancelled game) could complete a week whose winners were then
--     never computed.
--   * Moving an UNFINISHED game to another week/season type (a postponed
--     game rescheduled into week 18) completes the week it left — which
--     again was never recomputed.
--   * Moving a game to another season marked only the new season's pools.
--
-- Inserting an unfinished game still marks nothing: it can only make a week
-- incomplete, and incomplete weeks keep their recorded results by design.

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
    IF NOT public.confidence_game_is_finished(NEW.winner, NEW.status) THEN RETURN NULL; END IF;
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

DROP TRIGGER IF EXISTS confidence_results_dirty_games_del ON public.games;
CREATE TRIGGER confidence_results_dirty_games_del
  AFTER DELETE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.mark_confidence_results_dirty_from_games();
