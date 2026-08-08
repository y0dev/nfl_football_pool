# Supabase Cron Jobs Setup — `update-game-scores` & `determine-weekly-winners`

How the two scheduled Edge Functions are wired up in Supabase, how to (re)install
them from scratch, and how to fix the exact error you're hitting right now:

```json
{"success":true,"skipped":true,"reason":"A previous run is still in progress"}
```

**Short answer for that error:** the `cron_run_locks` table these functions depend
on has never been created in the live project — see [Fix: "previous run is still
in progress"](#fix-previous-run-is-still-in-progress) to resolve it immediately.
The rest of this doc is the full setup for reference / rebuilding from scratch.

---

## How this system fits together

| Piece | What it does | Where it lives |
|---|---|---|
| `update-game-scores` | Refreshes `status`/`home_score`/`away_score`/`winner` on `games` from ESPN | `supabase/functions/update-game-scores/index.ts` |
| `determine-weekly-winners` | Once a week's games are all final, computes scores and writes `weekly_winners`/`period_winners`/`season_winners` | `supabase/functions/determine-weekly-winners/index.ts` |
| `cron_run_locks` table | Mutual-exclusion lock so two overlapping invocations of the same job never race each other | `supabase/migrations/20260807190000_add_cron_run_locks.sql` |
| `pg_cron` + `pg_net` schedule | Calls both functions on a recurring schedule via HTTP, using the project's secret key | `supabase/migrations/20260803220827_schedule_winners_and_scores_cron.sql` |
| `update-game-scores` activity gate | Skips the actual ESPN call unless a game's kickoff has already passed but its status hasn't caught up yet — so the job is a no-op outside real game windows instead of hitting ESPN on every tick, all season | `supabase/migrations/20260808140000_restrict_update_game_scores_to_active_games.sql` |
| `_shared/cron-lock.ts` | Acquires/releases the lock row at the start/end of each run | `supabase/functions/_shared/cron-lock.ts` |

Both functions authenticate callers via `withSupabase({ auth: 'secret' })`, which
checks the project's **secret** (service-role) key on the `apikey` header — not
`Authorization: Bearer`. This requires `verify_jwt = false` for both functions
(already set in `supabase/config.toml`) so Supabase's own JWT gate doesn't reject
a secret-key caller before the function's own check runs.

---

## Prerequisites

- Supabase CLI via `npx supabase` (no global install needed — this repo's scripts
  already use `npx`).
- The project's **secret** (service-role) key, from **Dashboard → Project Settings
  → API Keys**. This is different from the **publishable** key — see the note in
  [Common mistakes](#common-mistakes) if you're not sure which one you have.
- Project ref: `muvtenjtdzlwcwmzksxy`.

---

## Step 1 — Apply the database migrations

Both migrations need to exist in the live project's database — `cron_run_locks`
(the lock table) and the `pg_cron` schedule itself.

**Option A — CLI (preferred):**

```bash
npx supabase link --project-ref muvtenjtdzlwcwmzksxy
npx supabase db push
```

If `link` fails with a `SchemaError` on `inserted_at` (a known CLI bug fetching
project API keys — see `docs/supabase-backend-audit.md` history), skip `link`
entirely and push directly against the database connection string instead:

```bash
npx supabase db push --db-url "postgresql://postgres:<db-password>@db.muvtenjtdzlwcwmzksxy.supabase.co:5432/postgres"
```

(Connection string is in **Dashboard → Project Settings → Database → Connection
string** — use the "URI" form and fill in your database password.)

**Option B — SQL Editor (always works, no CLI needed):**

Open **Dashboard → SQL Editor** and run each migration file's contents once, in
this order:

1. `supabase/migrations/20260807190000_add_cron_run_locks.sql` — creates the
   `cron_run_locks` table. **This is the one currently missing** — see the fix
   section below.
2. `supabase/migrations/20260803220827_schedule_winners_and_scores_cron.sql` —
   enables `pg_cron`/`pg_net`, stores the secret key in Vault, and schedules both
   functions. **Before running it**, replace the placeholder on this line with
   your real secret key:
   ```sql
   select vault.create_secret(
     'REPLACE_WITH_ACTUAL_SERVICE_ROLE_KEY',   -- <-- put the real secret key here
     'service_role_key',
     'Used by pg_cron to authorize calls to this project''s Edge Functions.'
   );
   ```
   Never commit the file with the real key filled in — paste it only in the SQL
   Editor at execution time, then leave the placeholder in the repo copy.

   If this migration was already run once before (so the `service_role_key`
   Vault secret already exists), re-running `vault.create_secret` for the same
   name will fail with a duplicate-key error. In that case, either skip that
   block and only re-run the two `cron.schedule(...)` calls below it (safe to
   re-run — `cron.schedule` is idempotent by job name), or update the secret
   instead:
   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'service_role_key'),
     'REPLACE_WITH_ACTUAL_SERVICE_ROLE_KEY'
   );
   ```

## Step 2 — Confirm the Edge Functions are deployed correctly

Deploy via the CLI, **not** the Dashboard's paste-source editor — the Dashboard
only uploads the single file you paste, so `update-game-scores/index.ts`'s
`import { tryAcquireLock, releaseLock } from '../_shared/cron-lock.ts'` fails to
bundle ("Module not found") because `_shared/` never gets uploaded with it.

```bash
npx supabase functions deploy update-game-scores --project-ref muvtenjtdzlwcwmzksxy
npx supabase functions deploy determine-weekly-winners --project-ref muvtenjtdzlwcwmzksxy
```

Or use the repo's script, which does both and defaults the project ref:

```bash
bash scripts/deploy-edge-function.sh
```

Confirm `verify_jwt = false` is set for both functions — it already is in
`supabase/config.toml`, and the CLI applies it on deploy. You can double-check in
**Dashboard → Edge Functions → (function) → Settings**.

## Step 3 — Verify the cron schedule registered

In the SQL Editor:

```sql
select jobname, schedule, active from cron.job;
```

You should see two rows: `update-game-scores` (`*/10 * * * *`) and
`determine-weekly-winners` (`5,15,25,35,45,55 * * * *`).

To see recent run history and whether calls are succeeding:

```sql
select jobname, status, return_message, start_time, end_time
from cron.job_run_details
order by start_time desc
limit 20;
```

## Step 4 — Manual testing

Use the repo's test scripts (they pull the right key automatically from
`.env.local` for `prod`, or from `npx supabase status` for `local`):

```bash
# PowerShell
.\scripts\test-edge-functions.ps1 prod scores
.\scripts\test-edge-functions.ps1 prod winners

# bash
scripts/test-edge-functions.sh prod scores
scripts/test-edge-functions.sh prod winners
```

A healthy response looks like:

```json
{"success":true,"message":"Updated 3 of 5 open games","updated":3,"checked":5,"timestamp":"..."}
```

or, if nothing needs doing right now:

```json
{"success":true,"message":"No open games to update","updated":0,"checked":0}
```

---

## Fix: "previous run is still in progress"

This message means `tryAcquireLock()` in `_shared/cron-lock.ts` returned `false`.
There are exactly two reasons that happens:

1. **A real previous run is genuinely still in flight** (lock row exists and is
   under 5 minutes old) — rare in practice, resolves itself.
2. **The `cron_run_locks` table doesn't exist**, so every query against it
   errors out, and the function treats that error the same as "lock held." This
   is almost certainly what's happening if you're seeing this on essentially
   every manual call.

Check which one you're in:

```sql
select to_regclass('public.cron_run_locks');
```

- Returns `null` → the table doesn't exist. Run
  `supabase/migrations/20260807190000_add_cron_run_locks.sql` (see
  [Step 1](#step-1--apply-the-database-migrations) above) via the SQL Editor:

  ```sql
  create table if not exists cron_run_locks (
    job_name text primary key,
    locked_at timestamptz not null
  );

  comment on table cron_run_locks is
    'Mutual-exclusion locks for scheduled Edge Functions. A row present and '
    'recent (see each function''s LOCK_STALE_MS) means that job is currently '
    'running; the function deletes its own row when it finishes. A stale row '
    '(older than LOCK_STALE_MS) is treated as an abandoned lock from a crashed '
    'run and is safely overwritten by the next invocation.';
  ```

  Then retest — the error should be gone immediately.

- Returns a value (table exists) → check for a stuck row:

  ```sql
  select job_name, locked_at, now() - locked_at as age from cron_run_locks;
  ```

  A row older than 5 minutes is stale and should have been overwritten
  automatically on the next call; if it wasn't, delete it manually:

  ```sql
  delete from cron_run_locks where job_name = 'update-game-scores';
  -- or 'determine-weekly-winners'
  ```

`_shared/cron-lock.ts` now logs the real underlying error (e.g. "table does not
exist") to the function's logs instead of silently swallowing it — check
**Dashboard → Edge Functions → (function) → Logs**, or `npx supabase functions
logs <function-name>`, for a `lock_select_failed` / `lock_upsert_failed` event
if this happens again after the table exists (this was fixed in this repo; if
you're on an older deploy, redeploy per Step 2 to pick it up).

---

## Common mistakes

- **Using the publishable key instead of the secret key.** Supabase's new key
  naming: **publishable** = old `anon` key (client-safe, RLS-gated). **secret**
  = old `service_role` key (server-only, elevated). `auth: 'secret'` only
  accepts the secret key (or the legacy `service_role` JWT, which still works
  during the transition period). A publishable key gets a platform-level
  `{"message":"Invalid credentials","code":"INVALID_CREDENTIALS"}` before your
  function code ever runs.
- **Deploying via the Dashboard's paste-source editor.** Always use the CLI
  (`npx supabase functions deploy ...`) so `_shared/` bundles correctly.
- **Sending `Authorization: Bearer`.** Not needed — only the `apikey` header is
  checked.
- **Committing a real key into the migration file.** Keep the
  `REPLACE_WITH_ACTUAL_SERVICE_ROLE_KEY` placeholder in source control; paste
  the real value only when running the migration in the SQL Editor.
