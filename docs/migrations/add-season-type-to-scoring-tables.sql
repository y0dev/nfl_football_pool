-- Fixes a week-number collision: preseason, regular season, and playoffs each
-- number their weeks independently (preseason week 1, regular season week 1,
-- and playoffs "week 1" a.k.a. Wild Card are three different sets of games),
-- but scores/weekly_winners/tie_breakers only ever kept (pool_id, week, season)
-- as the identity for a row. A pool scoped to more than one season type (e.g.
-- "Preseason + Regular Season") can have two real weeks sharing the same
-- week number, and these tables couldn't tell them apart.
--
-- weekly_winners and tie_breakers already have a season_type COLUMN in
-- production (added previously, outside this repo's migration history) and
-- app code is already writing correct values into it. What's still missing:
--   1. scores never got the column at all.
--   2. weekly_winners' UNIQUE constraint is still (pool_id, week, season) —
--      three columns, no season_type — so it currently REJECTS a second,
--      legitimate row for the same pool/week/season under a different
--      season_type instead of allowing it. Verified live: inserting a
--      duplicate with a different season_type fails with
--      `duplicate key value violates unique constraint
--      "weekly_winners_pool_id_week_season_key"`.
-- tie_breakers' constraint was verified to already include season_type
-- (a duplicate insert with a different season_type succeeded), so it's left
-- alone here.
--
-- Run this in the Supabase SQL editor before deploying the app changes that
-- accompany it, since those changes start filtering/writing season_type on
-- scores immediately.

-- 1. Add season_type to scores. Default 2 (regular season) matches every
--    row scores has ever practically held — this table isn't season-type
--    aware today, so there's nothing to backfill differently.
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS season_type INTEGER NOT NULL DEFAULT 2;

-- scores' own UNIQUE(participant_id, pool_id, week, season) has the same gap
-- as weekly_winners did. Widen it too if present under its default name.
ALTER TABLE scores
  DROP CONSTRAINT IF EXISTS scores_participant_id_pool_id_week_season_key;

ALTER TABLE scores
  ADD CONSTRAINT scores_participant_id_pool_id_week_season_season_type_key
  UNIQUE (participant_id, pool_id, week, season, season_type);

-- 2. Widen weekly_winners' uniqueness to include season_type so a pool with
--    e.g. both a preseason week 4 and (eventually) a regular season week 4
--    winner can store both rows instead of colliding.
ALTER TABLE weekly_winners
  DROP CONSTRAINT IF EXISTS weekly_winners_pool_id_week_season_key;

ALTER TABLE weekly_winners
  ADD CONSTRAINT weekly_winners_pool_id_week_season_season_type_key
  UNIQUE (pool_id, week, season, season_type);

-- If your project named that constraint differently, check Table Editor ->
-- weekly_winners -> and drop whatever UNIQUE(pool_id, week, season) shows as
-- before running the ADD CONSTRAINT above (it will fail if the old 3-column
-- constraint is still present under a different name).

-- 3. Helpful index for the common lookup pattern (pool + week + season +
--    season_type), mirroring the existing idx_scores_pool_week_season_rank.
CREATE INDEX IF NOT EXISTS idx_scores_pool_week_season_type
  ON scores(pool_id, week, season, season_type);
