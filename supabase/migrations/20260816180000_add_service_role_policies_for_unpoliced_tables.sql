-- Advisor: "RLS Enabled No Policy" on cron_run_locks, playoff_confidence_points,
-- playoff_teams. Not an actual gap — service_role already bypasses RLS
-- regardless of policy content, so these were already fully denied to
-- anon/authenticated. Adding explicit service_role policies purely for
-- consistency with every other table's convention in this project and to
-- clear the advisory.

CREATE POLICY "Service role can manage cron_run_locks" ON public.cron_run_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage playoff_confidence_points" ON public.playoff_confidence_points
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage playoff_teams" ON public.playoff_teams
  FOR ALL TO service_role USING (true) WITH CHECK (true);
