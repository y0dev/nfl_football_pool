# Database Schema Updates for Winner Tracking

This document outlines the database schema changes made to support weekly winners, season winners, and period winners with tie breaker tracking.

## Overview

The system now tracks winners at multiple levels:
- **Weekly Winners**: Winners for each individual week
- **Season Winners**: Overall winners for the entire season
- **Period Winners**: Winners for specific periods (e.g., Q1, Q2, Q3, Q4, Playoffs)

## Updated Tables

### 1. Scores Table

The `scores` table has been enhanced with winner tracking fields:

```sql
CREATE TABLE scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  points INTEGER DEFAULT 0,
  correct_picks INTEGER DEFAULT 0,
  total_picks INTEGER DEFAULT 0,
  rank INTEGER NULL,                    -- NEW: Position in weekly standings
  is_winner BOOLEAN DEFAULT false,      -- NEW: Whether this participant won the week
  tie_breaker_used BOOLEAN DEFAULT false, -- NEW: Whether tie breaker was used
  tie_breaker_rank INTEGER NULL,        -- NEW: Position after tie breaker resolution
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- NEW: Last update timestamp
  UNIQUE(participant_id, pool_id, week, season)
);
```

### 2. Tie Breakers Table

The `tie_breakers` table now includes winner tracking:

```sql
CREATE TABLE tie_breakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  answer DECIMAL(10,2) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_winner BOOLEAN DEFAULT false,      -- NEW: Whether this tie breaker won
  tie_breaker_rank INTEGER NULL,        -- NEW: Position in tie breaker standings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- NEW: Creation timestamp
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- NEW: Last update timestamp
  UNIQUE(participant_id, pool_id, week, season)
);
```

## New Tables

### 3. Weekly Winners Table

Stores the winner for each week of each pool:

```sql
CREATE TABLE weekly_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  winner_points INTEGER NOT NULL,
  winner_correct_picks INTEGER NOT NULL,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, week, season)
);
```

### 4. Season Winners Table

Stores the overall winner for each season:

```sql
CREATE TABLE season_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  total_points INTEGER NOT NULL,
  total_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, season)
);
```

### 5. Period Winners Table

Stores winners for specific periods (quarters, playoffs, etc.):

```sql
CREATE TABLE period_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES pools(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  period_name VARCHAR(50) NOT NULL,     -- e.g., 'Q1', 'Q2', 'Q3', 'Q4', 'Playoffs'
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  winner_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  winner_name VARCHAR(255) NOT NULL,
  period_points INTEGER NOT NULL,
  period_correct_picks INTEGER NOT NULL,
  weeks_won INTEGER NOT NULL DEFAULT 0,
  tie_breaker_used BOOLEAN DEFAULT false,
  tie_breaker_question VARCHAR(255) NULL,
  tie_breaker_answer DECIMAL(10,2) NULL,
  winner_tie_breaker_answer DECIMAL(10,2) NULL,
  tie_breaker_difference DECIMAL(10,2) NULL,
  total_participants INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, season, period_name)
);
```

## Indexes

Performance indexes have been added for better query performance:

```sql
CREATE INDEX idx_scores_pool_week_season ON scores (pool_id, week, season);
CREATE INDEX idx_scores_participant_season ON scores (participant_id, season);
CREATE INDEX idx_tie_breakers_pool_week_season ON tie_breakers (pool_id, week, season);
CREATE INDEX idx_weekly_winners_pool_season ON weekly_winners (pool_id, season);
CREATE INDEX idx_season_winners_pool_season ON season_winners (pool_id, season);
CREATE INDEX idx_period_winners_pool_season ON period_winners (pool_id, season);
```

## Migration

The schema updates are designed to be backward compatible. New columns are added to existing tables without breaking existing functionality. The migration script (`scripts/update-schemas.sql`) handles:

1. Adding new columns to existing tables
2. Creating new winner tables
3. Adding performance indexes
4. Preserving existing data

## Usage

### Calculating Weekly Winners

```typescript
import { calculateWeeklyWinners } from '@/lib/winner-calculator';

const weeklyWinner = await calculateWeeklyWinners(poolId, week, season);
```

### Calculating Season Winners

```typescript
import { calculateSeasonWinners } from '@/lib/winner-calculator';

const seasonWinner = await calculateSeasonWinners(poolId, season);
```

### Calculating Period Winners

```typescript
import { calculatePeriodWinners } from '@/lib/winner-calculator';

const periodWinner = await calculatePeriodWinners(poolId, season, 'Q1', 1, 4);
```

## Tie Breaker Resolution

The system automatically resolves ties using the following hierarchy:

1. **Primary**: Total points
2. **Secondary**: Tie breaker answer (closest to actual answer wins)
3. **Tertiary**: Weeks won (for season/period winners)
4. **Fallback**: Random selection (if no tie breaker available)

## Data Integrity

- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicate entries
- Cascade deletes maintain data consistency
- Timestamps track creation and updates

## Benefits

1. **Comprehensive Winner Tracking**: Track winners at multiple levels
2. **Tie Breaker Transparency**: Know when and how tie breakers were used
3. **Performance**: Optimized indexes for fast queries
4. **Flexibility**: Support for custom periods and tie breaker methods
5. **Audit Trail**: Complete history of winner calculations

## season_type on scores, weekly_winners, tie_breakers

Preseason, regular season, and playoffs each number their weeks independently
(preseason week 1, regular season week 1, and playoffs "week 1" a.k.a. Wild
Card are three different sets of games), but these three tables only ever
keyed a row by `(pool_id, week, season)`. A pool scoped to more than one
season type (e.g. "Preseason + Regular Season") could have two real weeks
sharing the same week number, and there was no way to tell them apart.

`weekly_winners` and `tie_breakers` already had a `season_type` **column**
added in production ahead of this repo catching up its migration history and
TypeScript types — but `weekly_winners`' UNIQUE constraint was still only
`(pool_id, week, season)`, so it actively rejected a second legitimate row for
a different season_type instead of allowing it. `scores` was missing the
column entirely.

Migration: `docs/migrations/add-season-type-to-scoring-tables.sql`

1. Adds `season_type` to `scores` (default 2, matching every row it has ever
   practically held).
2. Widens `weekly_winners`' unique constraint to `(pool_id, week, season,
   season_type)`.
3. Widens `scores`' own unique constraint the same way.

App code updated in the same change: `src/lib/winner-calculator.ts` now
threads `season_type` through weekly/period/season winner calculation and
tie-breaker resolution (period and season winners are always regular season —
`season_type = 2`); several API routes and two client pages that read
`scores`/`weekly_winners`/`tie_breakers` now filter by it too.

Known **not** touched, and why:

- `supabase/functions/update-games/index.ts` — placeholder/scaffold code
  (comments literally say "Simulate checking if game is finished"), not
  invoked anywhere in the app. Not real production code.
- `src/actions/adminActions.ts`'s `calculateWeeklyScores`/`updateScoresInDatabase`,
  `src/actions/loadPicksForLeaderboard.ts`, `src/lib/tie-breakers.ts`'s
  `applyTieBreakers`, `/api/admin/calculate-tie-breakers`,
  `/api/admin/weekly-stats` — none have any caller anywhere in the app
  (verified via search). Dead code, left alone.
- `scripts/seed.ts` — already broken independent of this: its `picks` and
  `scores` inserts use a stale `user_id` column instead of `participant_id`,
  predating this change.

## Huddles (parent entity for pools)

A commissioner's overall league is now a **Huddle**; a **Pool** is a specific
competition inside it (e.g. an NFL Confidence Pool). Previously pools were a
flat list with no grouping — a commissioner could already own multiple pools
(`pools.created_by = admins.email`, one-to-many), but there was nothing
representing "the league" as its own entity.

Migration: `docs/migrations/add-huddles.sql`, backfill in
`docs/migrations/add-huddles-backfill.sql` (run second — creates exactly one
Huddle per existing commissioner and points all of their pools at it).

1. New `huddles` table: `commissioner_email` mirrors `pools.created_by` (a
   plain string, not an FK — kept consistent with the existing ownership
   model rather than introducing a second identity representation).
2. New `huddle_co_commissioners` table — schema only, **not wired into any
   authorization logic yet**. Reserved for a future co-commissioner invite
   feature. The pre-existing `admin_pools` table (a different shape: FK to
   `admins.id`, keyed by `pool_id` not `huddle_id`) is left untouched — it
   was already dead code before this change and still is.
3. `pools.huddle_id` — nullable FK to `huddles`, `ON DELETE SET NULL` (not
   `CASCADE`): deleting a Huddle must never cascade-delete pools, picks, or
   scores.
4. `pools.competition_type` — **a new, separate axis from the existing
   `pool_type` column.** `pool_type` (`'normal'` / `'knockout'`) is an
   NFL-confidence-internal bracket concept and is untouched by this change.
   `competition_type` is the cross-sport/format discriminator: currently
   `NFL_CONFIDENCE` (the only value the app will actually create —
   `src/actions/createPool.ts` rejects anything else server-side even if a
   client somehow submits it), with `NCAA_CONFIDENCE`, `SURVIVOR`, `PICKEM`,
   `MARCH_MADNESS` reserved for future pool types. See
   `src/lib/poolTypes.ts` for the registry that drives both the UI picker
   and this server-side validation. (Wired up in the "Wire up Huddles and
   pool types" pass below — `poolTypes.ts` and the create-pool validation
   did not exist when this section was first written.)
5. `pools.type_settings` (JSONB) — per-competition-type configuration (e.g.
   a future survivor pool's "no repeat picks" rule) lives here, not as new
   `pools` columns, so adding a sixth `competition_type` later is a
   CHECK-constraint widen, not a schema migration.
6. Fixed pre-existing drift while this file was already being touched:
   `pools.is_private` has been written by `src/actions/createPool.ts` since
   pool search/privacy shipped, but was never added to a checked-in
   migration or to the TS `Database` type before now.

Known **not** touched, and why:

- Plan/capacity limits (`src/lib/plan.ts`, `checkPoolCapacity`) stay keyed
  on `created_by` email exactly as before. This pass creates exactly one
  Huddle per commissioner, so "pools per Huddle" and "pools per
  commissioner" are numerically identical today — there was no behavior to
  change. Once a commissioner can own more than one Huddle (not built yet),
  that's a real product decision for a future change, not this one.
- No participant-facing RLS policy on `huddles` — participants stay
  pool-scoped (no global participant account) and never query Huddles
  directly; "a Huddle's participants" is a derived cross-pool view in app
  code, not a new table or FK.

## Wire up Huddles and pool types

The previous section's schema shipped without any app code behind it. This
pass wires it up:

1. `docs/migrations/add-huddles-backfill.sql` now exists (it was referenced
   above but never checked in) — creates one Huddle per distinct existing
   commissioner and backfills `pools.huddle_id`. Run it manually via the
   Supabase SQL editor, after `add-huddles.sql`.
2. `src/lib/poolTypes.ts` now exists — the registry of `CompetitionType`
   values (label, description, `available` flag) that drives both the
   create-pool dropdown and server-side validation.
3. `src/lib/huddles.ts` — `getOrCreateHuddleForCommissioner(email)`, a
   find-or-create helper so commissioners created after the backfill still
   get exactly one Huddle, lazily, the first time they create a pool.
4. `src/actions/createPool.ts` — now accepts `competition_type`, rejects any
   value where `POOL_TYPES` marks `available: false` (making the claim in
   the section above actually true), and sets `huddle_id` on every pool it
   creates via the helper above.
5. `src/components/pools/create-pool-dialog.tsx` — added a "Competition Type"
   picker above the pool name field, driven by `POOL_TYPES`; unavailable
   types render disabled with a "(Coming Soon)" suffix.
6. `src/app/admin/pools/page.tsx` and `src/app/api/admin/all-pools/route.ts`
   — pool cards now show a competition-type badge; the API route's explicit
   column list was widened to include `competition_type`/`huddle_id`.
7. Removed the dead, unexported `Pool` interface in `src/types/game.ts` (no
   references anywhere in the app) rather than updating it to match the
   current schema, since nothing consumed it.

Known **still not** touched, and why (unchanged from the previous section):
no Huddle switcher/management UI, no co-commissioner wiring, `admin_pools`
still dead code. Multi-Huddle-per-commissioner remains a future product
decision, not something this pass changes.
