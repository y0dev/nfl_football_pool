-- Flexible confidence-pool payout settings. Sunday Huddle never collects,
-- holds, or transfers money — this is purely: (1) commissioner-configured
-- payout rules, (2) calculated dollar amounts derived from those rules plus
-- an optional entry fee, and (3) a commissioner-only "paid" record. Kept
-- entirely separate from scoring/leaderboard tables — payout config never
-- feeds back into who wins picks, only into how much a winner is owed.
--
-- One payout_configs row per pool (1:1), created lazily on first save —
-- absence of a row means payout tracking has never been configured, which
-- existing pools default to identically to a row with enabled = false.
--
-- weekly_positions / overall_positions store an ordered array of
-- {"place": 1, "percentage": 50} objects rather than fixed 1st/2nd/3rd
-- columns, since the commissioner chooses how many paid positions exist
-- (Step 13 — not hard-coded to three).
CREATE TABLE IF NOT EXISTS payout_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL UNIQUE REFERENCES pools(id) ON DELETE CASCADE,

  enabled BOOLEAN NOT NULL DEFAULT false,

  -- Used only for payout math (total pool = entry_fee * active participants).
  -- NULL/0 means the commissioner hasn't entered one — perfectly valid for a
  -- pool that's pure competition with no money involved.
  entry_fee NUMERIC(10,2),

  -- 'split': tied positions divide the combined payout evenly (default).
  -- 'tie_breaker': fall back to the pool's existing tie-breaker ranking.
  -- 'commissioner': no automatic split — flagged for the commissioner to
  -- decide manually in the calculator.
  tie_policy TEXT NOT NULL DEFAULT 'split'
    CHECK (tie_policy IN ('split', 'tie_breaker', 'commissioner')),

  weekly_enabled BOOLEAN NOT NULL DEFAULT false,
  -- 'fixed': weekly_amount is a flat dollar amount paid out every week.
  -- 'percentage': weekly_amount is a percentage (0-100) of the total prize
  -- pool (entry_fee * participants) — a calculation convenience, never an
  -- indication that Sunday Huddle is holding or moving that percentage.
  weekly_amount_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (weekly_amount_type IN ('fixed', 'percentage')),
  weekly_amount NUMERIC(10,2),
  weekly_positions JSONB NOT NULL DEFAULT '[{"place":1,"percentage":100}]'::jsonb,

  overall_enabled BOOLEAN NOT NULL DEFAULT false,
  overall_positions JSONB NOT NULL DEFAULT '[{"place":1,"percentage":50},{"place":2,"percentage":30},{"place":3,"percentage":20}]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_configs_pool_id ON payout_configs(pool_id);

-- Commissioner-only record of what's been paid out — "Mark Paid" never
-- moves money, it just tracks that the commissioner says they paid someone
-- outside the app. One row per (pool, scope, season, week, place); a
-- recalculation upserts on this key so an existing "paid" mark survives a
-- standings refresh instead of being wiped and losing the record.
CREATE TABLE IF NOT EXISTS payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('weekly', 'overall')),
  season INTEGER NOT NULL,
  -- NULL for 'overall' scope; required for 'weekly'.
  week INTEGER,
  season_type INTEGER,
  place INTEGER NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  -- Snapshot so the record still reads correctly if the participant is
  -- later removed from the pool.
  participant_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (pool_id, scope, season, week, place)
);

CREATE INDEX IF NOT EXISTS idx_payout_records_pool_id ON payout_records(pool_id);
