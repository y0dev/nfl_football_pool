-- Removes weekly_winners rows created by a display-layer bug (fixed in the
-- same change as this migration): a pool's Picks page resolved its default
-- week via the global "what NFL week is happening right now" lookup instead
-- of a pool-scoped one when no explicit ?week= was in the URL. For a pool
-- from a past season, that produced the CORRECT week number under the
-- WRONG (today's real-world) season year, and the client-side lazy-write
-- path (pool-picks-content.tsx's checkWeekStatus) persisted a winner row
-- under that wrong season — using data it happened to compute against the
-- real season's games/picks, so the wrong-season row has identical
-- winner_name/winner_points to the correct row for the pool's real season.
--
-- Deletes only rows matching that exact signature: a duplicate for the same
-- pool/week/season_type/winner_name/winner_points, where this row's season
-- does NOT match the pool's actual season on file and an earlier row for
-- the pool's real season already exists with the same result. Never
-- fabricates or guesses a result — only removes the corrupted copy where a
-- genuine, independently-created correct copy survives.
DELETE FROM weekly_winners bad
WHERE bad.season <> (SELECT p.season FROM pools p WHERE p.id = bad.pool_id)
  AND EXISTS (
    SELECT 1 FROM weekly_winners good
    JOIN pools p2 ON p2.id = good.pool_id
    WHERE good.pool_id = bad.pool_id
      AND good.week = bad.week
      AND good.season_type = bad.season_type
      AND good.season = p2.season
      AND good.winner_name = bad.winner_name
      AND good.winner_points = bad.winner_points
      AND good.id <> bad.id
  );
