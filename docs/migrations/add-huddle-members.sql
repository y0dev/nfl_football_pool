-- Add the League (Huddle) roster: a directory of people who belong to a
-- commissioner's Huddle, independent of any specific pool. Run this after
-- add-huddles.sql / add-huddles-backfill.sql. Safe to re-run.

-- email is nullable: a commissioner can add a member with no email and
-- notify them manually instead (see make-huddle-member-email-optional.sql
-- for the follow-up patch on databases that ran this file before that
-- became nullable here).
CREATE TABLE IF NOT EXISTS huddle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (huddle_id, email)
);
CREATE INDEX IF NOT EXISTS idx_huddle_members_huddle_id ON huddle_members (huddle_id);

-- Links a pool-scoped participant row back to the League roster entry it
-- came from, so "which pools is this member already in" can be queried
-- without matching on name/email. Nullable + additive: every existing
-- participants row (self-serve joins, CSV imports, prior direct adds) stays
-- NULL and keeps working exactly as it does today.
ALTER TABLE participants ADD COLUMN IF NOT EXISTS huddle_member_id UUID
  REFERENCES huddle_members(id) ON DELETE SET NULL;

ALTER TABLE huddle_members ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage huddle members" ON huddle_members
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
