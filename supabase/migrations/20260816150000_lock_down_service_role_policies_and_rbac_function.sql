-- Two classes of live vulnerability found by the Advisor's "RLS Policy
-- Always True" and "Public Can Execute SECURITY DEFINER Function" checks:
--
-- 1. Several policies named "Service role can ..." / "Allow service role
--    operations" were never actually scoped to the service_role — they were
--    created with the default `roles = {public}`, so their `USING (true)`
--    applied to *every* Postgres role, including anon and authenticated.
--    Since Supabase's service_role already bypasses RLS entirely, these
--    policies served no purpose for the service role and only opened the
--    door to unauthenticated direct-REST reads/writes. Verified via code
--    search that every real write to these tables goes through
--    getSupabaseServiceClient() (which bypasses RLS regardless of policy
--    content) — restricting these policies to service_role has zero effect
--    on the app and only removes external attack surface.
--
-- 2. assign_admin_role() is a SECURITY DEFINER function with no internal
--    caller check, and had EXECUTE granted to anon/authenticated — anyone
--    could call it via /rest/v1/rpc/assign_admin_role to insert arbitrary
--    admin_roles rows. Confirmed via code search it's unused by the app
--    (the app's real authorization model resolves roles via
--    findAccountByEmail against admins/commissioners, not admin_roles) —
--    revoking public EXECUTE is a pure security fix, no behavior depends on it.

ALTER POLICY "Allow service role operations" ON public.admins
  TO service_role;

ALTER POLICY "Service role can insert games" ON public.games
  TO service_role;
ALTER POLICY "Service role can update games" ON public.games
  TO service_role;
ALTER POLICY "Service role can delete games" ON public.games
  TO service_role;

ALTER POLICY "Users can join pools" ON public.participants
  TO service_role;

ALTER POLICY "Anyone can insert picks" ON public.picks
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.assign_admin_role(
  uuid, character varying, uuid, character varying, uuid, timestamp with time zone, jsonb
) FROM PUBLIC, anon, authenticated;
