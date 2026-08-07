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
-- editor. The project ref (muvtenjtdzlwcwmzksxy) is already filled in below
-- — only the service_role_key secret still needs to be substituted before
-- running (see the REPLACE BEFORE RUNNING note just below).

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

-- determine-weekly-winners — every 10 minutes, offset 5 minutes after each
-- update-game-scores tick below, so it always runs against freshly-synced
-- scores/statuses rather than racing it on an independent schedule (the two
-- jobs have a real dependency: winners can only be computed correctly once
-- that week's game results are in).
select cron.schedule(
  'determine-weekly-winners',
  '5,15,25,35,45,55 * * * *',
  $$
  select net.http_post(
    url := 'https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/determine-weekly-winners',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- update-game-scores — every 10 minutes, on the hour/10-minute marks (e.g.
-- :00, :10, :20...) so determine-weekly-winners's :05/:15/:25... schedule
-- above always follows it by ~5 minutes.
select cron.schedule(
  'update-game-scores',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/update-game-scores',
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
--
-- Timezone: pg_cron schedules are evaluated in the database's configured
-- timezone, which defaults to UTC on Supabase-hosted projects (unmodified
-- here). Both schedules above are minute-interval patterns rather than
-- fixed-hour ones, so UTC vs. local time doesn't change their behavior —
-- noted for the record per this repo's cron-job checklist, not because it
-- matters for these particular schedules.
--
-- Concurrency: both Edge Functions acquire a lock (see
-- supabase/functions/_shared/cron-lock.ts and the
-- 20260807190000_add_cron_run_locks.sql migration) before doing any work,
-- so an overlapping tick (e.g. a slow determine-weekly-winners run still
-- in progress when the next :05/:15/... mark arrives) is skipped rather
-- than running concurrently against the same rows.
