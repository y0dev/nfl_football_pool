-- The original (pool_id, scope, season, week, place) unique constraint
-- assumed one participant per place. But calculatePayouts() correctly gives
-- every member of a tied group the SAME place (e.g. three participants
-- tied for 1st all get place=1, shown as "T-1st") — so saving a tied
-- calculation tried to upsert multiple rows sharing one conflict key in the
-- same statement, which Postgres rejects ("ON CONFLICT DO UPDATE command
-- cannot affect row a second time"). The real uniqueness is per
-- PARTICIPANT's payout for a given (pool, scope, season, week), not per
-- place — multiple participants legitimately share a place when tied.
ALTER TABLE payout_records DROP CONSTRAINT IF EXISTS payout_records_pool_id_scope_season_week_place_key;

ALTER TABLE payout_records
  ADD CONSTRAINT payout_records_pool_id_scope_season_week_participant_id_key
  UNIQUE (pool_id, scope, season, week, participant_id);
