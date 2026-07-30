-- Backfill for docs/migrations/add-huddles.sql — run this SECOND, after that
-- file. Creates exactly one Huddle per distinct existing commissioner, then
-- points all of their pools at it. Safe to re-run: skips commissioners who
-- already have a huddle, and only backfills pools with a NULL huddle_id.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT created_by FROM pools
    WHERE created_by IS NOT NULL
      AND created_by NOT IN (SELECT commissioner_email FROM huddles)
  LOOP
    INSERT INTO huddles (name, commissioner_email)
    VALUES (r.created_by || '''s Huddle', r.created_by);
  END LOOP;
END $$;

UPDATE pools p
SET huddle_id = h.id
FROM huddles h
WHERE p.huddle_id IS NULL AND p.created_by = h.commissioner_email;
