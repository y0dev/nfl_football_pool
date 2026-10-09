-- Pick drafts: a safety net for a participant who starts making picks but
-- never hits Submit before the week locks at first kickoff. The picks UI
-- (src/lib/pick-storage.ts) auto-saves the in-progress selections here after
-- 2 minutes of inactivity, so a commissioner can review and submit them on
-- the participant's behalf from the override-picks page
-- (src/app/league/pool/[id]/override-picks/[participantId]/page.tsx)
-- instead of the participant simply scoring zero for the week. Deliberately
-- separate from `picks` (the authoritative, scored table) — a draft must
-- never be mistaken for a real submission by any scoring/leaderboard query.
-- One row per participant per week (upserted as they keep changing their
-- selections), cleared once either the participant submits for real
-- (src/app/api/picks/submit/route.ts) or a commissioner submits an override
-- on their behalf (src/app/api/admin/override-picks/route.ts, 'week' mode).
CREATE TABLE IF NOT EXISTS public.pick_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  season_type SMALLINT NOT NULL,
  week INTEGER NOT NULL,
  picks JSONB NOT NULL DEFAULT '[]',
  monday_night_score INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT pick_drafts_one_per_week UNIQUE (participant_id, pool_id, season, season_type, week)
);

CREATE INDEX IF NOT EXISTS idx_pick_drafts_pool_week ON public.pick_drafts (pool_id, season, season_type, week);

ALTER TABLE public.pick_drafts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage pick_drafts" ON public.pick_drafts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
