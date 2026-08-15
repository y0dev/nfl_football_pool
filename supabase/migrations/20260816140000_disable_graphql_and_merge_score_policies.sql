-- 1) "Public Can See Object in GraphQL Schema" warnings (games and every
-- other publicly-readable table) — this app never uses Supabase's GraphQL
-- API (grepped the whole codebase: zero references to /graphql or
-- pg_graphql; all data access is via supabase-js REST or custom Next.js
-- API routes). Disabling the extension removes every table from the
-- GraphQL schema in one shot, matching the advisor's own suggested fix,
-- rather than chasing this table-by-table.
DROP EXTENSION IF EXISTS pg_graphql;

-- 2) Remaining "Multiple Permissive Policies" cases (scores, tie_breakers)
-- — on reflection these ARE safe to fix: Postgres ORs multiple permissive
-- policies together for the same command, so replacing two policies
-- (A, B) with one policy containing `A_condition OR B_condition` is
-- exactly equivalent, not a behavior change — just one policy evaluation
-- instead of two. (A previous migration left these alone out of caution;
-- that caution wasn't actually necessary since this is a pure merge, not
-- a narrowing.)
DROP POLICY IF EXISTS "Admins can view all scores" ON scores;
DROP POLICY IF EXISTS "Users can only view their own scores" ON scores;
CREATE POLICY "Admins and participants can view scores" ON scores
  FOR SELECT USING (
    (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true))
    OR (participant_id IN (SELECT participants.id FROM participants WHERE (participants.email)::text = ((select auth.jwt()) ->> 'email'::text)))
  );

DROP POLICY IF EXISTS "Admins can view all tie-breakers" ON tie_breakers;
DROP POLICY IF EXISTS "Users can only view their own tie-breakers" ON tie_breakers;
CREATE POLICY "Admins and participants can view tie-breakers" ON tie_breakers
  FOR SELECT USING (
    (EXISTS (SELECT 1 FROM admins WHERE admins.id = (select auth.uid()) AND admins.is_active = true))
    OR (participant_id IN (SELECT participants.id FROM participants WHERE (participants.email)::text = ((select auth.jwt()) ->> 'email'::text)))
  );
