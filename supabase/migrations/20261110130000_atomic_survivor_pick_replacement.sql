-- Atomic Survivor pick replacement.
--
-- submitSurvivorPick() (src/lib/survivor.ts) used to delete the
-- participant's pick for the week, then check team reuse, then insert. A
-- rejected or failed change (team already used, constraint violation,
-- network error) left the participant with no pick at all for that week.
-- Playoff picks are changeable until lock, so this hit real updates.
--
-- This function does the delete and insert in one transaction (any error
-- rolls both back), serialized per participant/pool/season, and re-checks
-- team reuse after taking the lock. The app still validates first so the
-- common rejections never reach the database.
CREATE OR REPLACE FUNCTION public.replace_survivor_pick(
  p_participant_id uuid,
  p_pool_id uuid,
  p_game_id varchar,
  p_season integer,
  p_season_type integer,
  p_week integer,
  p_selected_team varchar,
  p_submitted_by varchar DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Two concurrent submissions for the same participant can't interleave.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'survivor_pick:' || p_participant_id::text || ':' || p_pool_id::text || ':' || p_season::text, 0));

  IF EXISTS (
    SELECT 1 FROM survivor_picks
    WHERE participant_id = p_participant_id AND pool_id = p_pool_id AND season = p_season
      AND selected_team = p_selected_team
      AND NOT (season_type = p_season_type AND week = p_week)
  ) THEN
    RAISE EXCEPTION 'SURVIVOR_TEAM_ALREADY_USED'
      USING HINT = 'Each team can be used once per season.';
  END IF;

  DELETE FROM survivor_picks
  WHERE participant_id = p_participant_id AND pool_id = p_pool_id AND season = p_season
    AND season_type = p_season_type AND week = p_week;

  INSERT INTO survivor_picks (participant_id, pool_id, game_id, season, season_type, week, selected_team, submitted_by)
  VALUES (p_participant_id, p_pool_id, p_game_id, p_season, p_season_type, p_week, p_selected_team, p_submitted_by)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_survivor_pick(uuid, uuid, varchar, integer, integer, integer, varchar, varchar)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_survivor_pick(uuid, uuid, varchar, integer, integer, integer, varchar, varchar)
  TO service_role;
