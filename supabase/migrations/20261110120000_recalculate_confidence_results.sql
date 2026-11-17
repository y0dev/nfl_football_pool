-- Makes Confidence Pool scores and winners follow corrections.
--
-- Before this migration, determine-weekly-winners only ever filled in rows
-- that were missing ("already_recorded" was a skip), and its pg_cron gate
-- only invoked it when a row was missing. A game corrected after its week
-- had been scored therefore never changed scores, weekly_winners,
-- period_winners or season_winners. The scores rewrite was also a plain
-- delete followed by an insert, so a failed insert left the week with no
-- scores at all.
--
-- 1. confidence_results_dirty: one row per pool whose results may be out of
--    date. Triggers on games / picks / tie_breakers / participants / pools
--    mark a pool when something its results depend on changes.
-- 2. apply_confidence_pool_results(): applies the function's computed write
--    plan in a single transaction, so a failure leaves every stored row as
--    it was.
-- 3. The cron gate now invokes the function only when an active Confidence
--    pool is marked. The function clears the mark only after that pool's
--    write succeeded, so a failed pool is retried on the next tick.

-- ---------------------------------------------------------------------------
-- Finished-game rule, mirrored from isGameFinished() in
-- supabase/functions/_shared/confidence-results.ts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confidence_game_is_finished(p_winner text, p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_winner IS NOT NULL OR lower(coalesce(p_status, '')) IN ('final', 'finished', 'post', 'cancelled');
$$;

-- ---------------------------------------------------------------------------
-- Dirty marks. No foreign key to pools on purpose: a trigger fired while a
-- pool and its picks are being deleted must not fail that delete. Rows for
-- pools that no longer exist are ignored by the gate and removed by the
-- function.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.confidence_results_dirty (
  pool_id UUID PRIMARY KEY,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.confidence_results_dirty IS
  'Confidence pools whose scores/winners may be stale. Written by triggers, '
  'cleared by the determine-weekly-winners Edge Function after a successful recompute.';

ALTER TABLE public.confidence_results_dirty ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage confidence_results_dirty" ON public.confidence_results_dirty
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.mark_confidence_pools_dirty(p_pool_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.confidence_results_dirty (pool_id, marked_at)
  SELECT DISTINCT id, clock_timestamp() FROM unnest(p_pool_ids) AS id WHERE id IS NOT NULL
  ON CONFLICT (pool_id) DO UPDATE SET marked_at = EXCLUDED.marked_at;
$$;

REVOKE ALL ON FUNCTION public.mark_confidence_pools_dirty(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_confidence_pools_dirty(uuid[]) TO service_role;

-- games: a result changed on a game that is (or was) finished. Marks every
-- active Confidence pool in that season.
CREATE OR REPLACE FUNCTION public.mark_confidence_results_dirty_from_games()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season integer := CASE WHEN TG_OP = 'DELETE' THEN OLD.season ELSE NEW.season END;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT public.confidence_game_is_finished(OLD.winner, OLD.status)
       AND NOT public.confidence_game_is_finished(NEW.winner, NEW.status) THEN
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NOT public.confidence_game_is_finished(NEW.winner, NEW.status) THEN RETURN NULL; END IF;
  END IF;

  PERFORM public.mark_confidence_pools_dirty(array_agg(p.id))
  FROM public.pools p
  WHERE p.season = v_season
    AND p.is_active = true
    AND coalesce(p.competition_type, 'NFL_CONFIDENCE') IN ('NFL_CONFIDENCE', 'NCAA_CONFIDENCE');
  RETURN NULL;
END;
$$;

-- picks: only picks on finished games affect recorded results.
CREATE OR REPLACE FUNCTION public.mark_confidence_results_dirty_from_picks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pool_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP <> 'INSERT' AND EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = OLD.game_id AND public.confidence_game_is_finished(g.winner, g.status)
  ) THEN
    v_pool_ids := v_pool_ids || OLD.pool_id;
  END IF;
  IF TG_OP <> 'DELETE' AND EXISTS (
    SELECT 1 FROM public.games g WHERE g.id = NEW.game_id AND public.confidence_game_is_finished(g.winner, g.status)
  ) THEN
    v_pool_ids := v_pool_ids || NEW.pool_id;
  END IF;
  IF cardinality(v_pool_ids) > 0 THEN
    PERFORM public.mark_confidence_pools_dirty(v_pool_ids);
  END IF;
  RETURN NULL;
END;
$$;

-- tie_breakers / participants / pools: mark the row's own pool.
CREATE OR REPLACE FUNCTION public.mark_confidence_results_dirty_from_pool_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'pools' THEN
    PERFORM public.mark_confidence_pools_dirty(ARRAY[NEW.id]);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.mark_confidence_pools_dirty(ARRAY[OLD.pool_id]);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.mark_confidence_pools_dirty(ARRAY[OLD.pool_id, NEW.pool_id]);
  ELSE
    PERFORM public.mark_confidence_pools_dirty(ARRAY[NEW.pool_id]);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_confidence_results_dirty_from_games() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_confidence_results_dirty_from_picks() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_confidence_results_dirty_from_pool_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS confidence_results_dirty_games_ins ON public.games;
CREATE TRIGGER confidence_results_dirty_games_ins
  AFTER INSERT ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.mark_confidence_results_dirty_from_games();

DROP TRIGGER IF EXISTS confidence_results_dirty_games_upd ON public.games;
CREATE TRIGGER confidence_results_dirty_games_upd
  AFTER UPDATE OF winner, status, week, season, season_type ON public.games
  FOR EACH ROW
  WHEN (OLD.winner IS DISTINCT FROM NEW.winner
        OR OLD.status IS DISTINCT FROM NEW.status
        OR OLD.week IS DISTINCT FROM NEW.week
        OR OLD.season IS DISTINCT FROM NEW.season
        OR OLD.season_type IS DISTINCT FROM NEW.season_type)
  EXECUTE FUNCTION public.mark_confidence_results_dirty_from_games();

DROP TRIGGER IF EXISTS confidence_results_dirty_picks ON public.picks;
CREATE TRIGGER confidence_results_dirty_picks
  AFTER INSERT OR UPDATE OR DELETE ON public.picks
  FOR EACH ROW EXECUTE FUNCTION public.mark_confidence_results_dirty_from_picks();

DROP TRIGGER IF EXISTS confidence_results_dirty_tie_breakers ON public.tie_breakers;
CREATE TRIGGER confidence_results_dirty_tie_breakers
  AFTER INSERT OR UPDATE OR DELETE ON public.tie_breakers
  FOR EACH ROW EXECUTE FUNCTION public.mark_confidence_results_dirty_from_pool_row();

DROP TRIGGER IF EXISTS confidence_results_dirty_participants ON public.participants;
CREATE TRIGGER confidence_results_dirty_participants
  AFTER UPDATE OF is_active, name, pool_id OR DELETE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.mark_confidence_results_dirty_from_pool_row();

DROP TRIGGER IF EXISTS confidence_results_dirty_pools ON public.pools;
CREATE TRIGGER confidence_results_dirty_pools
  AFTER UPDATE OF pool_type, tie_breaker_answer, tie_breaker_question, season, is_active ON public.pools
  FOR EACH ROW
  WHEN (OLD.pool_type IS DISTINCT FROM NEW.pool_type
        OR OLD.tie_breaker_answer IS DISTINCT FROM NEW.tie_breaker_answer
        OR OLD.tie_breaker_question IS DISTINCT FROM NEW.tie_breaker_question
        OR OLD.season IS DISTINCT FROM NEW.season
        OR (NEW.is_active AND NOT OLD.is_active))
  EXECUTE FUNCTION public.mark_confidence_results_dirty_from_pool_row();

-- ---------------------------------------------------------------------------
-- Transactional apply. p_plan is ResultWritePlan from
-- supabase/functions/_shared/confidence-results.ts. A PL/pgSQL function runs
-- inside the caller's single statement, so any error rolls back every write
-- made here.
--
-- Winner rows are matched on their natural key and updated in place (keeps
-- id/created_at), inserted only when absent. Legacy weekly_winners rows with
-- a NULL season_type are treated as regular season (2).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_confidence_pool_results(p_pool_id uuid, p_season integer, p_plan jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_week jsonb;
  v_row jsonb;
  v_count integer;
  v_scores_written integer := 0;
  v_weekly integer := 0;
  v_periods integer := 0;
  v_season text := null;
BEGIN
  IF p_pool_id IS NULL OR p_season IS NULL OR p_plan IS NULL THEN
    RAISE EXCEPTION 'apply_confidence_pool_results: pool, season and plan are required';
  END IF;

  -- Scores: replace each listed week wholesale.
  FOR v_week IN SELECT * FROM jsonb_array_elements(coalesce(p_plan->'scores', '[]'::jsonb)) LOOP
    DELETE FROM scores
    WHERE pool_id = p_pool_id AND season = p_season
      AND week = (v_week->>'week')::integer
      AND coalesce(season_type, 2) = (v_week->>'season_type')::integer;

    INSERT INTO scores (pool_id, season, season_type, week, participant_id, points, correct_picks, total_picks)
    SELECT p_pool_id, p_season, (v_week->>'season_type')::integer, (v_week->>'week')::integer,
           (r->>'participant_id')::uuid, (r->>'points')::integer, (r->>'correct_picks')::integer, (r->>'total_picks')::integer
    FROM jsonb_array_elements(coalesce(v_week->'rows', '[]'::jsonb)) AS r;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_scores_written := v_scores_written + v_count;
  END LOOP;

  -- Weekly winners.
  DELETE FROM weekly_winners w
  USING jsonb_array_elements(coalesce(p_plan->'weekly_deletes', '[]'::jsonb)) AS d
  WHERE w.pool_id = p_pool_id AND w.season = p_season
    AND w.week = (d->>'week')::integer
    AND coalesce(w.season_type, 2) = (d->>'season_type')::integer;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_plan->'weekly_upserts', '[]'::jsonb)) LOOP
    UPDATE weekly_winners SET
      season_type = (v_row->>'season_type')::integer,
      winner_participant_id = (v_row->>'winner_participant_id')::uuid,
      winner_name = v_row->>'winner_name',
      winner_points = (v_row->>'winner_points')::integer,
      winner_correct_picks = (v_row->>'winner_correct_picks')::integer,
      tie_breaker_used = coalesce((v_row->>'tie_breaker_used')::boolean, false),
      tie_breaker_question = v_row->>'tie_breaker_question',
      tie_breaker_answer = (v_row->>'tie_breaker_answer')::numeric,
      winner_tie_breaker_answer = (v_row->>'winner_tie_breaker_answer')::numeric,
      tie_breaker_difference = (v_row->>'tie_breaker_difference')::numeric,
      total_participants = (v_row->>'total_participants')::integer,
      updated_at = now()
    WHERE pool_id = p_pool_id AND season = p_season
      AND week = (v_row->>'week')::integer
      AND coalesce(season_type, 2) = (v_row->>'season_type')::integer;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO weekly_winners (pool_id, season, week, season_type, winner_participant_id, winner_name, winner_points,
        winner_correct_picks, tie_breaker_used, tie_breaker_question, tie_breaker_answer, winner_tie_breaker_answer,
        tie_breaker_difference, total_participants)
      VALUES (p_pool_id, p_season, (v_row->>'week')::integer, (v_row->>'season_type')::integer,
        (v_row->>'winner_participant_id')::uuid, v_row->>'winner_name', (v_row->>'winner_points')::integer,
        (v_row->>'winner_correct_picks')::integer, coalesce((v_row->>'tie_breaker_used')::boolean, false),
        v_row->>'tie_breaker_question', (v_row->>'tie_breaker_answer')::numeric,
        (v_row->>'winner_tie_breaker_answer')::numeric, (v_row->>'tie_breaker_difference')::numeric,
        (v_row->>'total_participants')::integer);
    END IF;
    v_weekly := v_weekly + 1;
  END LOOP;

  -- Period winners.
  DELETE FROM period_winners
  WHERE pool_id = p_pool_id AND season = p_season
    AND period_name IN (SELECT jsonb_array_elements_text(coalesce(p_plan->'period_deletes', '[]'::jsonb)));

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_plan->'period_upserts', '[]'::jsonb)) LOOP
    UPDATE period_winners SET
      start_week = (v_row->>'start_week')::integer,
      end_week = (v_row->>'end_week')::integer,
      winner_participant_id = (v_row->>'winner_participant_id')::uuid,
      winner_name = v_row->>'winner_name',
      period_points = (v_row->>'period_points')::integer,
      period_correct_picks = (v_row->>'period_correct_picks')::integer,
      weeks_won = (v_row->>'weeks_won')::integer,
      tie_breaker_used = coalesce((v_row->>'tie_breaker_used')::boolean, false),
      tie_breaker_question = v_row->>'tie_breaker_question',
      tie_breaker_answer = (v_row->>'tie_breaker_answer')::numeric,
      winner_tie_breaker_answer = (v_row->>'winner_tie_breaker_answer')::numeric,
      tie_breaker_difference = (v_row->>'tie_breaker_difference')::numeric,
      total_participants = (v_row->>'total_participants')::integer,
      updated_at = now()
    WHERE pool_id = p_pool_id AND season = p_season AND period_name = v_row->>'period_name';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO period_winners (pool_id, season, period_name, start_week, end_week, winner_participant_id, winner_name,
        period_points, period_correct_picks, weeks_won, tie_breaker_used, tie_breaker_question, tie_breaker_answer,
        winner_tie_breaker_answer, tie_breaker_difference, total_participants)
      VALUES (p_pool_id, p_season, v_row->>'period_name', (v_row->>'start_week')::integer, (v_row->>'end_week')::integer,
        (v_row->>'winner_participant_id')::uuid, v_row->>'winner_name', (v_row->>'period_points')::integer,
        (v_row->>'period_correct_picks')::integer, (v_row->>'weeks_won')::integer,
        coalesce((v_row->>'tie_breaker_used')::boolean, false), v_row->>'tie_breaker_question',
        (v_row->>'tie_breaker_answer')::numeric, (v_row->>'winner_tie_breaker_answer')::numeric,
        (v_row->>'tie_breaker_difference')::numeric, (v_row->>'total_participants')::integer);
    END IF;
    v_periods := v_periods + 1;
  END LOOP;

  -- Season winner.
  IF coalesce((p_plan->>'season_delete')::boolean, false) THEN
    DELETE FROM season_winners WHERE pool_id = p_pool_id AND season = p_season;
    v_season := 'deleted';
  END IF;

  v_row := p_plan->'season_upsert';
  IF v_row IS NOT NULL AND jsonb_typeof(v_row) = 'object' THEN
    UPDATE season_winners SET
      winner_participant_id = (v_row->>'winner_participant_id')::uuid,
      winner_name = v_row->>'winner_name',
      total_points = (v_row->>'total_points')::integer,
      total_correct_picks = (v_row->>'total_correct_picks')::integer,
      weeks_won = (v_row->>'weeks_won')::integer,
      tie_breaker_used = coalesce((v_row->>'tie_breaker_used')::boolean, false),
      tie_breaker_question = v_row->>'tie_breaker_question',
      tie_breaker_answer = (v_row->>'tie_breaker_answer')::numeric,
      winner_tie_breaker_answer = (v_row->>'winner_tie_breaker_answer')::numeric,
      tie_breaker_difference = (v_row->>'tie_breaker_difference')::numeric,
      total_participants = (v_row->>'total_participants')::integer,
      updated_at = now()
    WHERE pool_id = p_pool_id AND season = p_season;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      INSERT INTO season_winners (pool_id, season, winner_participant_id, winner_name, total_points, total_correct_picks,
        weeks_won, tie_breaker_used, tie_breaker_question, tie_breaker_answer, winner_tie_breaker_answer,
        tie_breaker_difference, total_participants)
      VALUES (p_pool_id, p_season, (v_row->>'winner_participant_id')::uuid, v_row->>'winner_name',
        (v_row->>'total_points')::integer, (v_row->>'total_correct_picks')::integer, (v_row->>'weeks_won')::integer,
        coalesce((v_row->>'tie_breaker_used')::boolean, false), v_row->>'tie_breaker_question',
        (v_row->>'tie_breaker_answer')::numeric, (v_row->>'winner_tie_breaker_answer')::numeric,
        (v_row->>'tie_breaker_difference')::numeric, (v_row->>'total_participants')::integer);
    END IF;
    v_season := 'upserted';
  END IF;

  RETURN jsonb_build_object('scores_written', v_scores_written, 'weekly_upserts', v_weekly, 'period_upserts', v_periods, 'season', v_season);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_confidence_pool_results(uuid, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_confidence_pool_results(uuid, integer, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Cron gate: run when any active Confidence pool is marked. Replaces the
-- "a row is missing" gate from 20260808150000, which never fired for a
-- correction and (because it didn't filter competition_type) fired on every
-- tick for Survivor/Pick'em pools that never get weekly_winners rows.
-- cron.schedule is idempotent by job name.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'determine-weekly-winners',
  '5,15,25,35,45,55 * * * *',
  $$
  do $body$
  begin
    if exists (
      select 1
      from public.confidence_results_dirty d
      join public.pools p on p.id = d.pool_id
      where p.is_active = true
        and coalesce(p.competition_type, 'NFL_CONFIDENCE') in ('NFL_CONFIDENCE', 'NCAA_CONFIDENCE')
    ) then
      perform net.http_post(
        url := 'https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/determine-weekly-winners',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb
      );
    end if;
  end;
  $body$;
  $$
);

-- Reconcile every active Confidence pool once, so results recorded before
-- this migration are checked against current data on the first run.
SELECT public.mark_confidence_pools_dirty(array_agg(id))
FROM public.pools
WHERE is_active = true
  AND coalesce(competition_type, 'NFL_CONFIDENCE') IN ('NFL_CONFIDENCE', 'NCAA_CONFIDENCE');
