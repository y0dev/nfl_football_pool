-- Add Huddle entity as parent of pools, and formalize pool competition type.
-- Run this in the Supabase SQL editor. Safe to re-run (all IF NOT EXISTS /
-- ADD COLUMN IF NOT EXISTS / guarded CHECK constraint).
--
-- Backfill (populating huddle_id for existing pools) is a SEPARATE file —
-- run docs/migrations/add-huddles-backfill.sql AFTER this one.

-- 1. Huddles table (the commissioner's overall league; parent of pools).
CREATE TABLE IF NOT EXISTS huddles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  commissioner_email VARCHAR(255) NOT NULL, -- mirrors pools.created_by (string, not an FK)
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_huddles_commissioner_email ON huddles (commissioner_email);

-- 2. Co-commissioner table — schema only, NOT wired into any authorization
--    logic yet. Reserved for a future "invite a co-commissioner" feature.
CREATE TABLE IF NOT EXISTS huddle_co_commissioners (
  huddle_id UUID REFERENCES huddles(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (huddle_id, admin_email)
);

-- 3. Pools: link to huddle, add competition_type + type_settings.
--    ON DELETE SET NULL (not CASCADE) — deleting a Huddle must never
--    cascade-delete pools/picks/scores.
ALTER TABLE pools ADD COLUMN IF NOT EXISTS huddle_id UUID REFERENCES huddles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pools_huddle_id ON pools (huddle_id);

-- competition_type is a NEW, separate axis from the existing pool_type
-- column (pool_type is 'normal'/'knockout', an NFL-confidence-internal
-- bracket concept — it is NOT the sport/format discriminator).
ALTER TABLE pools ADD COLUMN IF NOT EXISTS competition_type VARCHAR(20) NOT NULL DEFAULT 'NFL_CONFIDENCE';

DO $$ BEGIN
  ALTER TABLE pools ADD CONSTRAINT pools_competition_type_check
    CHECK (competition_type IN ('NFL_CONFIDENCE', 'NCAA_CONFIDENCE', 'SURVIVOR', 'PICKEM', 'MARCH_MADNESS'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Per-competition-type config (e.g. survivor's "no repeat picks" rule, NCAA
-- bracket size) lives here, never as new pools columns — so adding a 6th
-- competition_type later is a CHECK-constraint widen, not a schema change.
ALTER TABLE pools ADD COLUMN IF NOT EXISTS type_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Fix pre-existing drift: is_private has been written by
--    src/actions/createPool.ts since pool-search/privacy shipped, but was
--    never added via a checked-in migration or to the TS Database type.
ALTER TABLE pools ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- 5. RLS — huddles are commissioner/admin-only. Participants never query
--    huddles directly (they stay pool-scoped), so no participant-facing
--    policy is added here.
ALTER TABLE huddles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage huddles" ON huddles FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE huddle_co_commissioners ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage huddle co-commissioners" ON huddle_co_commissioners FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
