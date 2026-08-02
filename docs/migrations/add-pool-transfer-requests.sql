-- Adds pool_transfer_requests: backs the commissioner-facing "Transfer to
-- Another League" flow for a single pool (initiatePoolTransfer /
-- confirmPoolTransfer in src/actions/poolTransfers.ts). A commissioner hands
-- off one pool — and its participants, merged into the destination
-- commissioner's Huddle roster — to another commissioner's League. Both the
-- sender and the recipient must confirm by email before it takes effect.
-- Mirrors docs/migrations/add-huddle-transfer-requests.sql, scoped to a pool
-- instead of an entire Huddle.
--
-- Run this after add-huddles.sql and add-huddle-members.sql. Safe to
-- re-run (all IF NOT EXISTS / guarded CHECK constraint).

CREATE TABLE IF NOT EXISTS pool_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  -- pending: awaiting one or both confirmations
  -- completed: both confirmed, pool + participants moved
  -- cancelled: superseded by a newer request for the same pool
  -- failed: both confirmed, but execution couldn't complete (destination's
  --   pool or participant limit was exceeded at confirm time) — see
  --   failure_reason
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Two separate tokens so the sender's and recipient's confirmation links
  -- are independent — neither party can use the other's link.
  from_token UUID NOT NULL DEFAULT gen_random_uuid(),
  to_token UUID NOT NULL DEFAULT gen_random_uuid(),
  from_confirmed_at TIMESTAMP WITH TIME ZONE,
  to_confirmed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  -- Sender's choice, captured at request time, applied once the transfer
  -- actually executes (both sides confirmed) — see confirmPoolTransfer.
  -- If you already ran this file before this column existed, run
  -- add-pool-transfer-remove-from-source-roster.sql too.
  remove_from_source_roster BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE pool_transfer_requests ADD CONSTRAINT pool_transfer_requests_status_check
    CHECK (status IN ('pending', 'completed', 'cancelled', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_pool_transfer_requests_pool_id ON pool_transfer_requests (pool_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_transfer_requests_from_token ON pool_transfer_requests (from_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_transfer_requests_to_token ON pool_transfer_requests (to_token);

ALTER TABLE pool_transfer_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage pool transfer requests" ON pool_transfer_requests
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
