-- Performance Advisor: "Unindexed foreign keys" + "Unused Index".
--
-- Part 1 — add a covering index for every FK column that didn't have one.
-- Unindexed FKs make joins on that relationship (and cascading
-- update/delete checks against the referenced table) do a full table scan
-- instead of an index lookup.
CREATE INDEX IF NOT EXISTS idx_participants_huddle_member_id ON public.participants (huddle_member_id);
CREATE INDEX IF NOT EXISTS idx_participants_pool_id ON public.participants (pool_id);
CREATE INDEX IF NOT EXISTS idx_payments_admin_id ON public.payments (admin_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_participant_id ON public.payout_records (participant_id);
CREATE INDEX IF NOT EXISTS idx_period_winners_winner_participant_id ON public.period_winners (winner_participant_id);
CREATE INDEX IF NOT EXISTS idx_picks_game_id ON public.picks (game_id);
CREATE INDEX IF NOT EXISTS idx_picks_pool_id ON public.picks (pool_id);
CREATE INDEX IF NOT EXISTS idx_pools_monday_night_game_id ON public.pools (monday_night_game_id);
CREATE INDEX IF NOT EXISTS idx_season_winners_winner_participant_id ON public.season_winners (winner_participant_id);
CREATE INDEX IF NOT EXISTS idx_tie_breakers_game_id ON public.tie_breakers (game_id);
CREATE INDEX IF NOT EXISTS idx_weekly_winners_winner_participant_id ON public.weekly_winners (winner_participant_id);

-- Part 2 — drop only the indexes proven redundant (a duplicate, or a strict
-- leftmost-prefix subset of another index that already covers it), not
-- every index the Advisor flagged as zero-scan. Left everything else alone:
-- every other flagged index either backs a UNIQUE constraint (dropping it
-- would remove the uniqueness guarantee, not just a performance path — the
-- Advisor's "unused" scan-count check doesn't distinguish constraint
-- enforcement from lookup usage) or is a plausible, non-duplicate index on
-- a low-traffic app where "zero scans so far" isn't proof it's dead.
DROP INDEX IF EXISTS public.idx_admin_verifications_token; -- duplicate of unique admin_verifications_token_key
DROP INDEX IF EXISTS public.idx_team_records_team_season; -- duplicate of unique team_records_team_id_season_key
DROP INDEX IF EXISTS public.idx_period_winners_pool_season; -- leftmost-prefix subset of unique period_winners_pool_id_season_period_key
