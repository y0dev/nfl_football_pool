-- Fixes for issues flagged by the Supabase Security/Performance Advisor.
--
-- 1) RLS was disabled entirely on 4 tables (2 introduced by the payout
--    feature, 2 pre-existing from the NFL-sync-preview feature). All access
--    to these tables in this app goes through the service-role client
--    server-side (never a client-held anon/authenticated key), so each gets
--    the same single "service role only" ALL policy already used for every
--    other admin/service-managed table in this schema (payments,
--    season_settings, huddles, etc.) — nothing else reads/writes them.
-- 2) Three trigger/RPC functions had a mutable search_path, which is a
--    search-path-hijacking risk for SECURITY DEFINER functions in
--    particular (assign_admin_role). Pinned to `public` on all three.
-- 3) Existing RLS policies called auth.uid()/auth.jwt()/auth.role()
--    directly, which Postgres re-evaluates per row instead of once per
--    query. Rewritten to call them via a `(select ...)` subquery instead —
--    this changes evaluation cost only, not access semantics (identical
--    boolean result either way).
-- 4) A handful of tables had a second, narrower SELECT policy that was
--    already fully covered by an unconditional `true` "publicly viewable"
--    policy on the same table (permissive policies OR together, so
--    `condition OR true` is always true) — those narrower policies were
--    dead weight, flagged as "Multiple Permissive Policies". Dropped only
--    where provably redundant; left everything else alone rather than risk
--    changing real access semantics.

-- ── 1) Enable RLS on the 4 disabled tables ──────────────────────────────
ALTER TABLE payout_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfl_sync_proposed_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage payout configs" ON payout_configs
  FOR ALL USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role can manage payout records" ON payout_records
  FOR ALL USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role can manage nfl sync runs" ON nfl_sync_runs
  FOR ALL USING ((select auth.role()) = 'service_role');

CREATE POLICY "Service role can manage nfl sync proposed changes" ON nfl_sync_proposed_changes
  FOR ALL USING ((select auth.role()) = 'service_role');

-- ── 2) Pin search_path on flagged functions ─────────────────────────────
ALTER FUNCTION public.update_team_records_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.assign_admin_role(
  admin_id_param uuid, role_param character varying, pool_id_param uuid,
  scope_param character varying, assigned_by_param uuid,
  expires_at_param timestamp with time zone, metadata_param jsonb
) SET search_path = public;

-- ── 3) Wrap auth.*() calls so they evaluate once per query, not per row ─
ALTER POLICY "Service role can access admin_verifications" ON admin_verifications
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Allow authenticated users" ON admins
  USING (((select auth.uid()))::text = (id)::text);

ALTER POLICY "Admins can view audit logs" ON audit_logs
  USING (
    (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true))
    OR ((select auth.role()) = 'service_role'::text)
  );
ALTER POLICY "Service role can manage audit logs" ON audit_logs
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Commissioners can view their own profile" ON commissioners
  USING (id = (select auth.uid()) OR (select auth.role()) = 'service_role'::text);
ALTER POLICY "Service role can manage commissioners" ON commissioners
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Service role can manage huddle co-commissioners" ON huddle_co_commissioners
  USING ((select auth.role()) = 'service_role'::text);
ALTER POLICY "Service role can manage huddle members" ON huddle_members
  USING ((select auth.role()) = 'service_role'::text);
ALTER POLICY "Service role can manage huddle transfer requests" ON huddle_transfer_requests
  USING ((select auth.role()) = 'service_role'::text);
ALTER POLICY "Service role can manage huddles" ON huddles
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Only admins can insert participants" ON participants
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true));
ALTER POLICY "Only admins can update participants" ON participants
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true));
-- "Users can join pools" was `true OR <auth calls>` — already unconditionally
-- true regardless of the auth calls, so this drops the dead auth calls
-- entirely rather than just wrapping them (same net effect, cheaper).
ALTER POLICY "Users can join pools" ON participants
  WITH CHECK (true);

ALTER POLICY "Service role can manage payments" ON payments
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Admins can view all picks" ON picks
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true));

ALTER POLICY "Service role can manage pool transfer requests" ON pool_transfer_requests
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Admins can view pools they created" ON pools
  USING ((created_by)::text = ((select auth.jwt()) ->> 'email'::text) OR (select auth.role()) = 'service_role'::text);
ALTER POLICY "Service role can manage pools" ON pools
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Admins can view all scores" ON scores
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true));
ALTER POLICY "Users can only view their own scores" ON scores
  USING (participant_id IN (SELECT participants.id FROM participants WHERE (participants.email)::text = ((select auth.jwt()) ->> 'email'::text)));

ALTER POLICY "Service role can manage season settings" ON season_settings
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Service role can manage team records" ON team_records
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Service role can manage teams" ON teams
  USING ((select auth.role()) = 'service_role'::text);

ALTER POLICY "Admins can view all tie-breakers" ON tie_breakers
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true));
ALTER POLICY "Users can only insert tie-breakers for themselves" ON tie_breakers
  WITH CHECK (participant_id IN (SELECT participants.id FROM participants WHERE (participants.email)::text = ((select auth.jwt()) ->> 'email'::text)));
ALTER POLICY "Users can only view their own tie-breakers" ON tie_breakers
  USING (participant_id IN (SELECT participants.id FROM participants WHERE (participants.email)::text = ((select auth.jwt()) ->> 'email'::text)));

-- ── 4) Drop policies made fully redundant by an unconditional-true policy
--       on the same table + command (permissive policies OR together, so
--       `X OR true` == `true` — the narrower policy has zero effect). ─────
DROP POLICY IF EXISTS "Allow authenticated users" ON admins; -- redundant with "Allow service role operations" (qual = true)
DROP POLICY IF EXISTS "Users can view period winners for pools they participate in" ON period_winners; -- redundant with "Period winners are publicly viewable"
DROP POLICY IF EXISTS "Users can view season winners for pools they participate in" ON season_winners; -- redundant with "Season winners are publicly viewable"
DROP POLICY IF EXISTS "Users can view weekly winners for pools they participate in" ON weekly_winners; -- redundant with "Weekly winners are publicly viewable"
