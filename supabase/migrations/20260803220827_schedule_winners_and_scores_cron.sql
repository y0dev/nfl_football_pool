-- Schedules the determine-weekly-winners and update-game-scores Edge
-- Functions to run natively in Supabase via pg_cron + pg_net, replacing the
-- previous (non-functional) approach of a per-function cron.json file and a
-- `supabase functions cron create` deploy-script line — neither of those is
-- actually consumed by Supabase, so this cron never ran in production and
-- weekly_winners/period_winners/season_winners/scores were never populated
-- despite months of live game data.
--
-- Assumes pg_cron, pg_net, and Vault are available on this Supabase
-- project (true for all current Supabase-hosted projects).
--
-- Run this once via `supabase db push` or by pasting it into the SQL
-- editor. Before running: replace <PROJECT_REF> below with this project's
-- actual ref in both net.http_post calls.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- REPLACE BEFORE RUNNING: substitute the real service_role key. Do not
-- commit this file to source control with a real key filled in — keep the
-- placeholder here and substitute the real value only at execution time.
select vault.create_secret(
  'REPLACE_WITH_ACTUAL_SERVICE_ROLE_KEY',
  'service_role_key',
  'Used by pg_cron to authorize calls to this project''s Edge Functions.'
);

-- determine-weekly-winners — every 30 minutes, matching the cadence
-- previously (and now inertly) declared in
-- supabase/functions/determine-weekly-winners/cron.json.
select cron.schedule(
  'determine-weekly-winners',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/determine-weekly-winners',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- update-game-scores — every 10 minutes, matching the cadence previously
-- (and now inertly) declared in
-- supabase/functions/update-game-scores/cron.json.
select cron.schedule(
  'update-game-scores',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/update-game-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- cron.schedule is idempotent by job name — re-running this migration
-- (e.g. via a repeated `supabase db push`) updates the existing schedule
-- rather than duplicating it.
