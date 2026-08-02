-- Move pre-existing pools into their commissioner's League (safety net —
-- redundant if add-huddles-backfill.sql already ran, harmless either way)
-- and backfill the League roster (huddle_members) from each pool's
-- existing participants, so people who joined before this feature existed
-- show up on /league instead of an empty roster.
--
-- Run this after add-huddles.sql, add-huddles-backfill.sql, and
-- add-huddle-members.sql. Safe to re-run.

-- 1. Ensure every pool has a huddle_id.
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

-- 2. Backfill the roster from existing participants. Only participants with
-- an email are auto-added — email is the only reliable way to dedupe the
-- same person across multiple pools in the same League. Participants with
-- no email are NOT auto-added (add them manually on /league if needed).
-- One roster row per distinct (huddle, email); if the same email appears
-- under slightly different names across pools, the earliest one wins.
INSERT INTO huddle_members (huddle_id, name, email)
SELECT DISTINCT ON (p.huddle_id, LOWER(participants.email))
  p.huddle_id, participants.name, LOWER(participants.email)
FROM participants
JOIN pools p ON p.id = participants.pool_id
WHERE p.huddle_id IS NOT NULL
  AND participants.email IS NOT NULL
  AND participants.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM huddle_members hm
    WHERE hm.huddle_id = p.huddle_id AND hm.email = LOWER(participants.email)
  )
ORDER BY p.huddle_id, LOWER(participants.email), participants.created_at ASC;

-- 3. Link each participant row back to its roster entry, so the League
-- roster correctly shows "in N of M pools" for pre-existing participants.
UPDATE participants
SET huddle_member_id = hm.id
FROM pools p, huddle_members hm
WHERE participants.pool_id = p.id
  AND p.huddle_id = hm.huddle_id
  AND participants.email IS NOT NULL
  AND LOWER(participants.email) = hm.email
  AND participants.huddle_member_id IS NULL;
