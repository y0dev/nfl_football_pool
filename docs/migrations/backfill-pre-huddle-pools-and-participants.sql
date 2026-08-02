-- Backfill pre-Huddle pools into the Huddle structure.
--
-- For every pool created before Huddles existed (huddle_id IS NULL):
--   1. Create a Huddle for its commissioner, if they don't have one yet.
--   2. Point the pool at that Huddle.
--   3. Merge the pool's participants into the Huddle roster
--      (huddle_members), deduped by email.
--   4. Link each participant back to its roster entry so the League page
--      can show "in N of M pools" correctly.
--
-- Equivalent to docs/migrations/backfill-huddle-members-from-participants.sql
-- (safe to run either — this is a fresh, self-contained copy wrapped in a
-- transaction). Safe to re-run: every step is guarded, so a second run is a
-- no-op.
--
-- Prerequisites: add-huddles.sql and add-huddle-members.sql must already
-- have run (huddles, huddle_members tables and pools.huddle_id /
-- participants.huddle_member_id columns must exist).
--
-- Run this in the Supabase SQL editor.

BEGIN;

-- 1. Create a Huddle for every commissioner who has pools but no Huddle yet.
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

-- 2. Point every pre-existing pool at its commissioner's Huddle.
UPDATE pools p
SET huddle_id = h.id
FROM huddles h
WHERE p.huddle_id IS NULL
  AND p.created_by = h.commissioner_email;

-- 3. Merge each Huddle's pool participants into the Huddle roster, deduped
-- by email (the only reliable way to recognize the same person across
-- multiple pools in the same Huddle). Participants with no email are NOT
-- auto-added — add them manually on /league if needed. If the same email
-- appears under slightly different names across pools, the earliest one
-- (by participants.created_at) wins.
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

-- 4. Link each participant row back to its Huddle roster entry.
UPDATE participants
SET huddle_member_id = hm.id
FROM pools p, huddle_members hm
WHERE participants.pool_id = p.id
  AND p.huddle_id = hm.huddle_id
  AND participants.email IS NOT NULL
  AND LOWER(participants.email) = hm.email
  AND participants.huddle_member_id IS NULL;

COMMIT;

-- ── Verification queries (read-only — run after the migration) ──────────

-- Any pool still missing a Huddle (should return 0 rows):
-- SELECT id, name, created_by FROM pools WHERE huddle_id IS NULL;

-- Participants with an email that never got linked to a roster entry
-- (should return 0 rows):
-- SELECT part.id, part.name, part.email, pl.name AS pool_name
-- FROM participants part
-- JOIN pools pl ON pl.id = part.pool_id
-- WHERE part.email IS NOT NULL
--   AND part.huddle_member_id IS NULL
--   AND part.is_active = true;

-- Huddle roster sizes, for a quick sanity check:
-- SELECT h.name, COUNT(hm.id) AS members
-- FROM huddles h
-- LEFT JOIN huddle_members hm ON hm.huddle_id = h.id
-- GROUP BY h.name
-- ORDER BY h.name;
