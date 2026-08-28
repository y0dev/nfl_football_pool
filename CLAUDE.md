# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server with Turbopack at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Playwright E2E tests (headless)
npm run test:headed  # Tests with visible browser
npm run test:ui      # Interactive test runner
npm run test:debug   # Debug test execution
npm run test:report  # View HTML test report
```

### Database & Data Scripts

```bash
npm run setup-db             # Initialize database tables
npm run seed                 # Seed initial data
npm run fetch-nfl-data       # Sync NFL teams and games
npm run fetch-games          # Sync games (add -- --start-week N --end-week N for range)
npm run fetch-games-postseason   # Weeks 19-22 (playoffs)
npm run test-email           # Test email configuration
npm run create-test-data     # Seed demo admins/pools/participants (also runs automatically before the e2e suite)
npm run cleanup-e2e-data     # Manually sweep leftover e2e-created pools/commissioners/huddles (also runs automatically after the e2e suite)
npm run close-season         # Lock a season and compute final winners (add close-season:dry for a dry run)
```

Other one-off maintenance scripts live in `scripts/` (migrations, plan backfills, pool transfers, key rotation) — check `package.json`'s `scripts` block for the current list rather than assuming this doc is exhaustive.

## Architecture

**Stack**: Next.js 16 (App Router) + TypeScript + Supabase (PostgreSQL) + Tailwind CSS + shadcn/ui + Stripe (billing)

### Pool Types

A pool's `competition_type` is one of `NFL_CONFIDENCE` (default), `PICKEM`, or `SURVIVOR` — all three are live/available. `NCAA_CONFIDENCE` and `MARCH_MADNESS` exist in the registry (`src/lib/poolTypes.ts`) but are marked unavailable (not shippable yet). Confidence and Pick'em share most leaderboard/payout plumbing; Survivor has its own elimination logic (`src/lib/survivor.ts`, `src/lib/survivor-settings.ts`) and its own picks/state tables. Pools are grouped under a commissioner's **Huddle** (a "League" in the UI) — one commissioner can run multiple pools (of possibly different types) inside one Huddle, subject to plan limits (`src/lib/plan.ts`).

### Data Flow

- **Client picks** → Server Action (`src/actions/submitPicks.ts`, plus `pickem`/`survivor`-specific equivalents) → API route → Supabase
- **Score calculation** → `src/lib/winner-calculator.ts` / `src/lib/season-review.ts` compute scores → stored in `scores` / `weekly_winners` / `period_winners` / `season_winners`
- **NFL game data** → ESPN API via `src/lib/nfl-api.ts` (falls back from API Sports) → `games` table
- **Scheduled scoring** → `pg_cron` + `pg_net` call two Supabase Edge Functions on a recurring schedule: `update-game-scores` (refreshes game status/score from ESPN) and `determine-weekly-winners` (once a week is final, computes weekly/period/season winners). A `cron_run_locks` table prevents overlapping runs. See `docs/cron-jobs-setup.md`.
- **Payments** → Stripe Checkout (`src/app/api/stripe/checkout`) → webhook (`src/app/api/stripe/webhook`) → `payments` table + `commissioners.plan`/`addon_pools`. One-time **per-season** purchases, not recurring subscriptions — see Billing below.
- **Email notifications** → `src/lib/email.ts` (Nodemailer, Hostinger/Titan SMTP) → templates in `src/lib/email-templates*.ts`

### Key Directories

| Path | Purpose |
|------|---------|
| `src/app/api/` | REST API routes; `admin/` has 50+ endpoints; `stripe/` handles checkout + webhook |
| `src/app/admin/` | Super-admin dashboard pages (system-wide pool/commissioner management, NFL sync) |
| `src/actions/` | Next.js server actions for mutations |
| `src/lib/` | Core services: `supabase.ts` (schema doc-strings + client), `payouts.ts`, `pool-access.ts` (private-pool passwords), `plan.ts` (plan/limit enforcement), `stripe.ts`, `winner-calculator.ts`, `season-review.ts`, `survivor.ts`, `pickem.ts`, `tie-breakers.ts`, `email.ts`, `nfl-api.ts` |
| `src/components/admin/` | Commissioner-facing admin UI (participant management, pick overrides, payouts, email controls) |
| `src/components/pools/` | Shared pool workspace shell used across all three pool types |
| `src/components/picks/` | Pick submission UI per pool type (drag-and-drop confidence points use `@dnd-kit`) |
| `src/components/leaderboard/` | Per-type leaderboard/standings panels |
| `src/components/legal/`, `src/components/cookie-consent/` | `/terms`, `/privacy`, and the first-visit cookie notice |
| `src/types/` | Shared TypeScript types — `game.ts` is the primary type file |
| `scripts/` | One-off DB setup, data migration, and seeding scripts (run via `tsx`) |
| `supabase/functions/` | Supabase Edge Functions for scheduled tasks (see Data Flow above) |
| `supabase/migrations/` | Timestamped SQL migrations — the authoritative, current schema source; the doc-string constants in `src/lib/supabase.ts` are documentation and can lag behind a recent migration |
| `tests/setup/` | Playwright global setup (seeds/reactivates shared test accounts) and global teardown (sweeps leftover e2e test data — see Testing below) |

### Database Schema (Supabase / PostgreSQL)

Auth/billing: `admins` (super admins), `commissioners` (regular, Stripe-billed pool owners — split out of `admins`), `payments`

Pools: `pools`, `huddles` (+ `huddle_members`, `huddle_co_commissioners`, `huddle_transfer_requests`), `admin_pools`, `pool_transfer_requests`, `participants`, `season_settings`

Picks/scoring (Confidence + Pick'em share `picks`/`scores`/`tie_breakers`; Survivor and Pick'em also have their own dedicated tables — check `docs/database-schema-updates.md` and recent migrations for exact names): `picks`, `scores`, `tie_breakers`

Winner tracking: `weekly_winners`, `season_winners`, `period_winners` (Q1–Q4 + playoffs), `playoff_teams`, `playoff_confidence_points`

Payouts (commissioner-configured payout *calculations* only — Sunday Huddle never collects or holds money): `payout_configs`, `payout_records`

Audit/tracking: `audit_logs`, `reminder_logs`, `nfl_sync_runs`, `nfl_sync_proposed_changes`, `cron_run_locks`

All schema TypeScript types and RLS policies are defined in `src/lib/supabase.ts`. See `docs/database-schema-updates.md` for schema change history and `supabase/migrations/` for the exact, current DDL.

### Season Types & Weeks

Games use `season_type` to distinguish preseason (weeks 1–4), regular season (weeks 5–18), and postseason (weeks 19–22). The week boundary logic lives in `src/actions/loadCurrentWeek.ts`. Q1–Q4 periods are a regular-season-only construct (`getRegularSeasonPeriods()` in `src/lib/utils.ts`).

### Auth Model

Two separate, non-overlapping auth paths:

- **Admins/Commissioners**: custom credential auth — `admins` (super admins) and `commissioners` (regular commissioners) are separate tables, each with `bcryptjs`-hashed `password_hash` OR Google OAuth (`google_linked` column, decoupled from password so an account can have both at once). Session is an httpOnly `sh-session` cookie set server-side (`src/actions/sessionCookie.ts`, `src/app/auth/callback/route.ts`); client-side state is managed by `src/lib/auth.tsx`. `is_super_admin`/role must always be re-verified against the DB (`verifyAdminStatus()`) — never trusted from a cookie or `localStorage`.
- **Participants**: no account, no password, no Supabase Auth. A participant is just a named row in `participants` (optionally with an email) that a commissioner manages; "who's picking" is a lightweight client-only session in `localStorage` (`src/lib/user-session.ts`), not a cookie. A **private** pool additionally gates all viewing behind a password, enforced via a separate signed/encrypted cookie (`src/lib/pool-access.ts`) — this is a pool-access gate, unrelated to participant identity.

### Billing (Stripe)

Commissioners have a Free or Standard plan, sold as a **one-time, per-season purchase** — not a recurring subscription (`mode: 'payment'` Checkout Sessions). Standard-plan commissioners can also buy additional per-season "add-on pools." A 7-day free trial is available (no card required, no auto-charge at trial end — it's a plain internal flag, not a Stripe subscription). Prices, trial length, and "sale mode" (a single env-driven on/off switch for promotional pricing) all live in `src/lib/pricing.ts`; the matching Stripe price IDs are resolved the same way in `src/lib/stripe.ts` so the displayed and charged price can never drift apart. The webhook (`src/app/api/stripe/webhook`) is idempotent and also reverts a plan/add-on grant if Stripe reports a refund. See `docs/stripe-billing-setup.md` for the full go-live checklist.

### Environment Variables

Required in `.env.local` (see `env.example`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY            # server-only; primary
NEXT_PUBLIC_SUPABASE_SERVICE_KEY     # fallback for client components still using the service client directly — being phased out, do not add new usages
POOL_ACCESS_SECRET                   # required for private pools to work at all
```

Optional: `API_SPORTS_KEY` (NFL data fallback), `SMTP_HOST/PORT/USER/PASS/FROM` (email), `UPSTASH_REDIS_REST_URL/TOKEN` (shared rate limiting across serverless instances — falls back to an in-memory limiter if unset), `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`STRIPE_PRICE_*` (billing routes 503 until set), `NEXT_PUBLIC_ENABLE_PRICING`, `NEXT_PUBLIC_SALE`/`NEXT_PUBLIC_SALE_LABEL`, `NEXT_PUBLIC_SITE_URL`. A handful of `NEXT_PUBLIC_*`/dev-only flags (debug panel, simulated picks, dummy data, dev password reset) are gated to `NODE_ENV === 'development'` in code, so they can't leak into a real production build regardless of what ends up in a deployed env file — see the comments in `env.example` before relying on any of them.

### Testing

Playwright e2e specs live in `tests/e2e/`. Global setup (`tests/setup/global-setup.ts`) seeds/reactivates a couple of shared demo admin accounts several specs depend on. Global teardown (`tests/setup/global-teardown.ts`) sweeps any pool/commissioner/huddle left behind by a spec that didn't clean up after itself (e.g. crashed before its own `finally` ran) — matched by the repo-wide convention of `"E2E "`-prefixed pool names and `e2e-*@sundayhuddle.*` emails every spec already uses. Don't run the Stripe specs (`stripe-payment.spec.ts`, the webhook-idempotency spec) as part of routine verification — they create real Supabase commissioner accounts that need manual cleanup; only run them when a change specifically touches billing logic.
