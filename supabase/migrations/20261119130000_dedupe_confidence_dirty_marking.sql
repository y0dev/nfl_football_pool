-- Fix: mark_confidence_pools_dirty() could fail — and abort the pick /
-- participant / tie-breaker write that fired it — when the same pool id
-- appeared more than once in its input.
--
-- The original body was
--   SELECT DISTINCT id, clock_timestamp() FROM unnest(p_pool_ids) ...
-- clock_timestamp() is volatile and evaluated per row, so DISTINCT ran over
-- (id, timestamp) pairs: two copies of one pool id with timestamps a
-- microsecond apart both survived, and INSERT ... ON CONFLICT DO UPDATE
-- then hit the same row twice ("ON CONFLICT DO UPDATE command cannot affect
-- row a second time"). Every same-pool UPDATE trigger passes
-- ARRAY[OLD.pool_id, NEW.pool_id], so on real Postgres (microsecond clock)
-- an ordinary pick override on a finished game could fail. PGlite's
-- millisecond clock usually hid it in tests.
--
-- Now ids are de-duplicated first, and one timestamp is taken per call.

CREATE OR REPLACE FUNCTION public.mark_confidence_pools_dirty(p_pool_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.confidence_results_dirty (pool_id, marked_at)
  SELECT ids.id, stamp.ts
  FROM (
    SELECT DISTINCT id FROM unnest(p_pool_ids) AS id WHERE id IS NOT NULL
  ) AS ids
  CROSS JOIN (SELECT clock_timestamp() AS ts) AS stamp
  ON CONFLICT (pool_id) DO UPDATE SET marked_at = EXCLUDED.marked_at;
$$;

REVOKE ALL ON FUNCTION public.mark_confidence_pools_dirty(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_confidence_pools_dirty(uuid[]) TO service_role;
