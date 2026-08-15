-- Second pass on Performance Advisor "Unused Index" hits, checked against
-- real pg_stat_user_indexes scan counts (not just table snapshots) and the
-- actual query shapes in the codebase.
--
-- idx_scores_pool_week_season and idx_tie_breakers_pool_week_season are
-- strict leftmost-prefix subsets of sibling indexes that DO show real scans
-- (idx_scores_pool_week_season_rank: 553, idx_scores_pool_week_season_type:
-- 49, idx_tie_breakers_pool_week_season_rank: 121) — any query matching the
-- 3-column prefix is already served by those 4-column indexes, so the
-- plain 3-column ones are pure duplicates. Both tables show real historical
-- activity on their siblings, so this isn't a small-table false positive.
--
-- idx_admin_verifications_expires_at: grepped the codebase, expires_at is
-- never used as a filter anywhere. Its sibling idx_admin_verifications_admin_id
-- has 115 real scans, so the table has real historical traffic — this
-- index just has no matching query.
--
-- Deliberately NOT touching (see conversation): idx_pools_huddle_id and
-- idx_weekly_winners_pool_season (tiny tables where Postgres prefers a seq
-- scan regardless of index existence, but both have confirmed real query
-- matches in winner-calculator.ts / determine-weekly-winners), any of the
-- 11 FK-covering indexes added in the prior migration (too new to have
-- scans yet), or anything backing a UNIQUE constraint.

DROP INDEX IF EXISTS public.idx_scores_pool_week_season;
DROP INDEX IF EXISTS public.idx_tie_breakers_pool_week_season;
DROP INDEX IF EXISTS public.idx_admin_verifications_expires_at;
