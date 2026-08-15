-- Second pass on "Multiple Permissive Policies" advisor warnings. The
-- previous migration (20260816120000) only dropped policies that were
-- fully dead (subsumed by an unconditional `true` policy on the exact
-- same command). This migration handles the remaining class: a table has
-- a narrow SELECT policy whose own OR-clause already includes the
-- service-role condition, plus a separate blanket "service role manages
-- everything" ALL policy. For SELECT specifically the ALL policy is fully
-- redundant (its condition is already part of the SELECT policy's OR), but
-- it's still required for INSERT/UPDATE/DELETE. Since Postgres has no way
-- to say "ALL except SELECT" in one policy, each ALL policy is split into
-- three command-specific ones (INSERT/UPDATE/DELETE) with the identical
-- condition — same effective permissions on every command, just without
-- the redundant SELECT overlap.
--
-- Left alone: scores and tie_breakers each have two genuinely different
-- SELECT policies (admin-view vs. own-view) with no service-role clause in
-- either — neither is redundant, so splitting isn't applicable there and
-- combining them would risk an actual permission change for a perf-only
-- advisory. Not touched.

-- audit_logs
DROP POLICY IF EXISTS "Service role can manage audit logs" ON audit_logs;
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can update audit logs" ON audit_logs
  FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can delete audit logs" ON audit_logs
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- commissioners
DROP POLICY IF EXISTS "Service role can manage commissioners" ON commissioners;
CREATE POLICY "Service role can insert commissioners" ON commissioners
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can update commissioners" ON commissioners
  FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can delete commissioners" ON commissioners
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- games (pre-existing policy has qual/with_check = true, not role-gated —
-- preserved exactly as-is, only split by command)
DROP POLICY IF EXISTS "Service role can manage games" ON games;
CREATE POLICY "Service role can insert games" ON games
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update games" ON games
  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Service role can delete games" ON games
  FOR DELETE USING (true);

-- pools
DROP POLICY IF EXISTS "Service role can manage pools" ON pools;
CREATE POLICY "Service role can insert pools" ON pools
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can update pools" ON pools
  FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can delete pools" ON pools
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- team_records
DROP POLICY IF EXISTS "Service role can manage team records" ON team_records;
CREATE POLICY "Service role can insert team records" ON team_records
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can update team records" ON team_records
  FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can delete team records" ON team_records
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- teams
DROP POLICY IF EXISTS "Service role can manage teams" ON teams;
CREATE POLICY "Service role can insert teams" ON teams
  FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can update teams" ON teams
  FOR UPDATE USING ((select auth.role()) = 'service_role') WITH CHECK ((select auth.role()) = 'service_role');
CREATE POLICY "Service role can delete teams" ON teams
  FOR DELETE USING ((select auth.role()) = 'service_role');

-- participants: "Users can join pools" already allows INSERT
-- unconditionally (true), which fully subsumes "Only admins can insert
-- participants" (admin-only) for the INSERT command — dropping it changes
-- nothing about actual effective permissions.
DROP POLICY IF EXISTS "Only admins can insert participants" ON participants;
