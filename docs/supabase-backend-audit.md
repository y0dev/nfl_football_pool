# Supabase Backend Audit

Full backend health audit of every Supabase component: Edge Functions, DB functions/RPCs/triggers, scheduled jobs, auth hooks, and webhooks. Performed 2026-08-07.

**Access constraints, stated up front**: this audit was run from an environment with the app's own service-role key (full read/write on every table via PostgREST — used throughout this doc for live data findings) but **no Supabase CLI authentication and no dashboard access**. Anything requiring the Management API or dashboard (Edge Function deployment status, configured secrets, pg_cron execution history) is marked **"unverifiable from this environment"** below rather than guessed. To close that gap: generate a personal access token at `supabase.com/dashboard/account/tokens` and either paste it to whoever runs the next audit pass or set it as `SUPABASE_ACCESS_TOKEN` — `npx supabase login`/`link`/`functions list`/`secrets list` can then verify those items for real.

---

## 1. Inventory

### Edge Functions (`supabase/functions/`)

| Name | Purpose | Trigger | Dependencies | Env vars |
|---|---|---|---|---|
| `determine-weekly-winners` | Computes and records weekly/period(Q1-Q4)/season winners per active pool from `picks` + `games.winner`, writing `scores`/`weekly_winners`/`period_winners`/`season_winners` | HTTP POST (manual, or the pg_cron schedule below once installed) | Deno std `http/server`, `@supabase/supabase-js@2` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (both auto-injected by Supabase into every deployed Edge Function — nothing to configure manually) |
| `update-game-scores` | Refreshes `status`/`home_score`/`away_score`/`winner` on `games` from ESPN's public scoreboard API for games not yet finished | HTTP POST (manual, or the pg_cron schedule below) | Deno std `http/server`, `@supabase/supabase-js@2`, ESPN public scoreboard API (no API key required) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

**Deployment status**: unverifiable from this environment (no CLI auth). Both functions' source is current in this repo as of this commit. To verify live deployment matches this source: Dashboard → Edge Functions → check "Last deployed" timestamp against this repo's latest commit touching `supabase/functions/`, or run `npx supabase functions deploy <name> --project-ref muvtenjtdzlwcwmzksxy` (after `supabase login`) to force-redeploy current source.

### Database Functions / RPCs / Triggers

**None exist in version control** — confirmed by a repo-wide search for `.rpc(` calls (zero in live app code) and `CREATE TRIGGER`/`CREATE FUNCTION` (zero in any `.sql` file). If any exist live in the database, they were created directly via the SQL Editor and are invisible from here — check Dashboard → Database → Functions and → Triggers, and if anything real is found there, export it into a tracked migration so it isn't silently lost on a project migration/restore.

(One RPC name, `exec_sql`, was referenced by a script — `scripts/migrate-winner-tables.ts` — but that script was a one-time, already-obsolete DDL helper and has been deleted as part of this audit; see §6.)

### Scheduled Jobs (pg_cron)

One migration: `supabase/migrations/20260803220827_schedule_winners_and_scores_cron.sql`. As of this audit it schedules:
- `update-game-scores` — `*/10 * * * *` (every 10 min, on the 10s)
- `determine-weekly-winners` — `5,15,25,35,45,55 * * * *` (every 10 min, offset 5 minutes after `update-game-scores`'s tick — see §5 for why this ordering matters)

**Fixed this session**: the migration previously had a literal `<PROJECT_REF>` placeholder in both Edge Function URLs — never substituted with the real ref, so this schedule (if anyone tried to actually run the SQL) would fail. Now uses the real project ref (`muvtenjtdzlwcwmzksxy`, read from `NEXT_PUBLIC_SUPABASE_URL`). The `vault.create_secret(...)` call still has a placeholder for the service-role key by design (never commit a real key to source control) — substitute the real value only when actually running the migration.

A second migration, `20260807190000_add_cron_run_locks.sql`, adds a `cron_run_locks` table used by both functions for concurrent-run protection (see §9).

**Installation status**: unverifiable from this environment whether either migration has actually been run against the live project. Check Dashboard → Database → Cron Jobs, or `select * from cron.job;` in the SQL Editor. If it doesn't show `update-game-scores` and `determine-weekly-winners`, the migration hasn't been applied yet — run it via `supabase db push` or paste it into the SQL Editor (after substituting the real service-role key for the placeholder).

### Auth Hooks

None found — no custom Auth Hooks are declared in any migration or the dashboard-adjacent config. Participant Google OAuth uses stock Supabase Auth with no hook customization; commissioner/admin login is entirely custom (bcrypt against the `admins`/`commissioners` tables, not Supabase Auth).

### Webhooks

No Supabase Database Webhooks found (the `supabase_functions.http_request` trigger pattern is absent from every migration). The only webhook in this system is the Stripe webhook, which is an **application-level** Next.js API route (`src/app/api/stripe/webhook/route.ts`), not a Supabase-level construct — out of scope for this Supabase backend audit, noted for completeness only.

### Duplicates / Deprecated — found and resolved this session

- `src/lib/supabase.ts` contained **two conflicting `CREATE TABLE games` schema-documentation strings**: a stale one (`gamesTable`, missing `is_active`, using the dead column name `game_status` instead of `status`) and the current one (`updatedGamesTable`, matches the live schema and every live query in the app). `scripts/setup-database.ts` imported the stale one but never actually used it (only `updatedGamesTable` was wired into the real setup execution list) — confirmed dead, deleted.
- `scripts/migrate-winner-tables.ts` and its companion `scripts/update-winner-schemas.sql` — a one-time DDL helper for creating the winners tables, superseded by the proper `supabase/migrations/` approach and referencing an RPC (`exec_sql`) not otherwise used anywhere. Confirmed no other references (only a historical mention in `docs/leaderboard-redesign-summary.md`), deleted.
- The per-function `cron.json` files (`supabase/functions/*/cron.json`) were already identified and removed in a prior audit pass — Supabase never reads them; they were aspirational/inert.

---

## 2/3. Deployment & Secrets Verification

**Unverifiable from this environment** (no CLI auth, no dashboard access) — see the access-constraints note at the top of this doc. What *is* confirmed: the app's own runtime env vars needed for the Next.js side (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `API_SPORTS_KEY`, SMTP vars) are present in `.env.local` and functioning (used throughout this audit to query live data, and confirmed working by the existing E2E test baseline). Edge Function secrets (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` inside the Deno runtime) are Supabase-managed and auto-injected — not something to configure by hand, but their presence in the deployed function can only be confirmed via `npx supabase secrets list` (needs CLI auth) or the Dashboard.

---

## 4. `update-game-scores` — Audit

Read in full. Findings:
- **Correctly scoped**: only touches `games` (`status`, `home_score`, `away_score`, `winner`, `updated_at`). Never touches `scores`/`weekly_winners`/anything downstream.
- **Duplicate-update-safe by construction**: only queries games where `status IN (scheduled, live)` — a finished game is never re-fetched or re-written by this function again.
- **Winner derivation is correct**: only sets a winner when both scores are present and unequal; a tie correctly leaves `winner: null` (matches the two real tie games found in §6).
- **±3-day ESPN window keyed by event ID** is a deliberate, documented design choice to sidestep this app's inconsistent week-numbering across season types — not a bug.
- **No bug found in the logic.** Its current real-world behavior (updating 0 games) is expected: there are no NFL games within ±3 days of today (2026-08-07) — confirmed via live query, every game in the `games` table for the upcoming 2026 season is still `status: scheduled` with kickoff dates in September.
- **Fixed this session**: added structured logging (start, `open_game_count`, ESPN `event_count` + window dates, `updated`/`checked` counts, duration, errors) so a future "is this actually broken or just no games this week" question is answerable from the logs alone.

## 5. `determine-weekly-winners` — Audit

Read in full (last session) and re-verified against live data (this session). Two real, independent findings — both fixed:

**Finding 1 — the reported `weeks: [], periods: [], season: null` is very likely correct, not a bug.** Live query confirmed: every 2026-season game across every active pool is still `scheduled` (zero finished games, checked across all 22 week/season_type combinations that exist). The function has nothing to compute yet for any active pool — this is the expected output for a season that hasn't started. There is no live data available to prove or disprove this for an in-progress season; re-verify once real games finish.

**Finding 2 — the response never explained *why* results were empty**, which is what actually made the (correct) empty output look like a bug. Fixed: every week/period/season entry in the response now always carries a `status` field (`created`, `already_recorded`, `no_games`, `not_all_finished` — with `games_finished`/`games_total` counts, `no_scorable_picks`, or `save_failed` with a `reason`) instead of being silently omitted from the array. `weeks: []` can no longer happen — you'll now see one entry per week explaining exactly what state it's in.

**Finding 3 — real, systemic bug in a *different* code path, found via live data, not in this function**: 21 of 25 existing `weekly_winners` rows have `total_participants: 0`. Traced to `pool-picks-content.tsx`'s `checkWeekStatus()` (the reactive client-side path — see below), which read `result.totalParticipants` from `/api/leaderboard`'s response — a field that route has **never actually returned**. Every weekly-winner row ever written by this path recorded a participant count of zero. **Fixed**: now uses `result.leaderboard?.length` (the real scored-participant count, already present in the same response). Confirmed via repo-wide search this was the only caller relying on the nonexistent field.

**Root cause of "the scoring pipeline doesn't reliably run," established by data, not inference**: the mechanism that has actually been keeping `weekly_winners` populated in production is not this Edge Function at all — it's a **reactive client-side path**. `pool-picks-content.tsx`'s `checkWeekStatus()` only computes and records a week's winner when a user happens to open that pool's Picks page *after* the week's games have ended. There is no equivalent reactive path for `scores`, `period_winners`, or (except via the separate, working `close-season.ts` script) `season_winners`. This explains the sparse, inconsistent data found in §6 — e.g. the one closed 2025-season pool has exactly 1 of its ~18 weeks recorded, whichever one a user happened to view after it ended. Getting the pg_cron schedule (§8) actually installed is the real fix — it makes winner computation systematic instead of dependent on which pages a user happens to click into.

## 6. Database Integrity

Checked live (service-role queries) this session:
- **Foreign keys / orphaned rows**: 0 orphaned `picks.participant_id`, 0 orphaned `picks.game_id`, 0 orphaned `picks.pool_id`, 0 orphaned `participants.pool_id`, 0 pools referencing a nonexistent `huddle_id`. Clean.
- **Every active pool's `season` matches real rows in `games`** — no season-lookup mismatch (all active-pool seasons have matching games; the earlier hypothesis that this might explain empty results was checked and ruled out — see §5 Finding 1 instead).
- **2 games marked `final` with `winner: null`**: both confirmed legitimate ties (Cowboys 40 – Packers 40, week 4 2025 regular season; Saints 17 – Jaguars 17, week 3 2025 preseason). Not a bug — `update-game-scores` and `determine-weekly-winners` both handle this correctly already.
- **`total_participants: 0` on 21/25 `weekly_winners` rows**: real bug, root-caused and fixed — see §5 Finding 3. The affected historical rows themselves were **not** modified (this is live production data belonging to real participants; correcting historical values wasn't done without explicit confirmation — only the code that writes *new* rows going forward was fixed).
- **2 `weekly_winners` rows with a `winner_name` but `winner_participant_id: null`**: minor, isolated anomaly (2 of 25 rows, both older, likely from a prior version of the reactive-path code before some refactor) — flagged for awareness, not chased further given the low count and no live repro path.
- **Duplicate/stale schema definitions**: resolved, see §1.

## 7. `curl: (3) URL rejected: Bad hostname`

The exact command that produced this was reviewed. The URL and project ref in it (`https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/determine-weekly-winners`) are actually correct — this is **not** the `<PROJECT_REF>` placeholder bug from §1/§8 (that command didn't come from this repo's migration file). The command's Authorization header also used the literal placeholder text `SUPABASE_ANON_KEY` instead of a real key, which would cause a 401 from the function, not a hostname-level curl error — so that's a second, separate problem in the same command, not the cause of "Bad hostname" itself.

Confirmed the `--data '{"name":"Functions"}'` body in the command is Supabase's generic "Hello World" scaffold example payload (`interface ReqPayload { name: string }`) — the same test snippet the dashboard shows for *any* function's "Invoke" panel, unrelated to what the function actually does. `determine-weekly-winners` ignores its request body entirely, so that payload was never the issue, and this does not indicate a different/duplicate function exists.

Best-available diagnosis (not fully reproducible without seeing the exact terminal session): the remaining, real candidate is a **Windows-terminal / multi-line bash-style curl snippet mismatch** — a common, well-known failure mode when pasting Supabase's dashboard-provided multi-line curl example (which uses backslash `\` for line continuation, a bash/zsh convention) into PowerShell, which uses backtick `` ` `` for continuation instead. The line fragments can concatenate in a way that corrupts the URL argument.

**Side observation, no action needed**: Supabase's current dashboard "Create a new function" scaffold now defaults to a newer runtime API (`jsr:@supabase/server`'s `withSupabase` helper + `jsr:@supabase/functions-js/edge-runtime.d.ts`), different from the `deno.land/std` `serve()` + manual `createClient()` pattern this repo's two functions use. Both styles are supported by Supabase's Edge Runtime — no need to rewrite working functions just because the dashboard's default template changed — but if new functions are created via the dashboard going forward, expect them to look structurally different from these two, which is expected and fine.

**Corrected, single-line, copy-paste-safe test command** (replace `YOUR_REAL_ANON_OR_SERVICE_KEY` with an actual key from `.env.local`, and note the function ignores its request body entirely so no `--data` is needed):

```
curl -X POST "https://muvtenjtdzlwcwmzksxy.supabase.co/functions/v1/determine-weekly-winners" -H "Authorization: Bearer YOUR_REAL_ANON_OR_SERVICE_KEY" -H "Content-Type: application/json"
```

Run this (in any shell — it has no line continuations to break) to confirm the hostname issue is resolved. If it still fails the same way, that would rule out the shell-pasting theory and point to something else (e.g. a DNS/network issue in that specific environment) — worth re-investigating with the exact error output at that point.

## 8. Scheduled Jobs + Execution Ordering

Fixed the `<PROJECT_REF>` placeholder (§1). Addressed the explicit dependency the task called out ("game scores should update before weekly winners are calculated"): the two cron schedules previously ran on fully independent cadences (`*/10` and `*/30`) with no ordering guarantee. Now staggered — `update-game-scores` on the 10-minute marks, `determine-weekly-winners` 5 minutes after each of those — so winner computation always runs against just-synced game data instead of racing it. Real execution-history verification (has this schedule actually fired, how often, any failures) is unverifiable from this environment; check Dashboard → Database → Cron Jobs → job run history, or `select * from cron.job_run_details order by start_time desc limit 20;` in the SQL Editor.

## 9. Logging & Observability

Added structured (single-line JSON, secret-free) logs to both functions: `start`, key milestones (`pools_loaded`/`pool_processed`/`scores_saved` for winners; `open_games_loaded`/`espn_events_fetched` for scores), `complete` (with counts and `duration_ms`), and `error` (message + duration). Every field is an id, count, status string, or timestamp — no keys, tokens, or credentials logged anywhere. Follows the existing `console.log(JSON.stringify({...}))` pattern already used elsewhere in this codebase (e.g. `src/lib/purchases.ts`'s `logEvent`).

### Additional cron-job hardening (per this repo's updated commit-policy checklist for CRON-type changes)

- **Concurrent-execution protection**: neither function had any guard against overlapping runs (e.g. a slow `determine-weekly-winners` invocation still processing when the next scheduled tick fires 10 minutes later). Added a shared lock helper (`supabase/functions/_shared/cron-lock.ts`, backed by a new `cron_run_locks` table — `supabase/migrations/20260807190000_add_cron_run_locks.sql`): each function acquires a lock keyed by its own name before doing any work, releases it in a `finally` block, and a stale lock (older than 5 minutes — comfortably longer than either job's expected runtime) is treated as an abandoned lock from a crashed run and safely overwritten rather than blocking forever.
- **Environment-variable validation**: both functions previously used a non-null assertion (`Deno.env.get('SUPABASE_URL')!`) with no explicit check — a missing env var would have failed with an unclear error deep inside `supabase-js`. Both now check explicitly at the top and return a clear 500 with a descriptive message if either `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing.
- **Idempotency, partial-failure handling, no-duplicate-records, and manual-invocability** were all already true of the existing design (upsert-with-existing-check pattern throughout, per-week try/continue semantics, plain HTTP POST endpoints) — confirmed, no changes needed.
- **Retry logic**: deliberately not added. Every write is already idempotent, and pg_cron's own recurring schedule is itself a reasonable retry mechanism for this kind of periodic reconciliation job — adding a second, in-function retry layer would add complexity without a clear benefit.
- **Automated tests for the cron logic changes**: **not added**. This repo has no Deno test setup for Edge Functions (they're outside the Playwright/Node test suite entirely), and standing one up is a real, separate infrastructure investment beyond this audit's scope — flagged here rather than silently skipped. Manual verification (§10) and this session's live-data investigation are the current substitute.
- **Local/dev-environment testing before commit**: not possible from this environment (no local Supabase stack, no CLI auth) — flagged rather than falsely claimed. The corrected curl command in §7 is the practical way to manually test after deploying.

## 10. End-to-End Verification

Honest scope: **full E2E with live completed-game data is not possible right now** — the 2026 season has zero finished games anywhere. What was verified with live data this session:
- The reactive client-side weekly-winner path: confirmed working (25 real rows exist), and its one real bug (§5 Finding 3) is now fixed.
- `close-season.ts`: confirmed working (the one `season_winners` row matches its logic exactly).
- `update-game-scores` and `determine-weekly-winners`'s logic: read in full, confirmed correct for the current (no-completed-games) state; no fake "finished" games were written to the live database to simulate a pass, since fabricating results against real pool/participant data was explicitly ruled out.

**Manual procedure to fully verify once real games exist** (preseason games are expected within the next few weeks): after the first week of games finishes, invoke `determine-weekly-winners` manually (via the corrected curl command in §7) and confirm its response shows `status: "created"` entries for the finished week(s), then spot-check the resulting `weekly_winners` rows against `/api/leaderboard`'s live-computed standings for the same pool/week — they should agree.

## 11. Performance

Light review — both functions already avoid N+1 patterns (batched per-week/per-pool queries throughout, no per-participant query loops). No changes made beyond what §5/§9 already touch; nothing further was warranted.

## 12. Final Verification

- `npx tsc --noEmit` — clean (no new errors; `supabase/**/*` is excluded from the TS project per `tsconfig.json`, so the Deno-syntax Edge Functions aren't type-checked by this — expected).
- `npm run build` — clean.
- `npm run test -- --project=chromium` — compared against the established baseline (144 passed / 35 pre-existing, unrelated failures).
