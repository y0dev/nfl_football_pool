-- Adds huddle_transfer_requests: backs the commissioner-facing "Transfer
-- Huddle" flow (initiateHuddleTransfer / confirmHuddleTransfer in
-- src/actions/huddleTransfers.ts). A commissioner hands off an entire
-- Huddle (and every pool in it) to another commissioner; both the sender
-- and the recipient must confirm by email before it takes effect.
--
-- Run this after add-huddles.sql. Safe to re-run (all IF NOT EXISTS /
-- guarded CHECK constraint).

CREATE TABLE IF NOT EXISTS huddle_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id UUID NOT NULL REFERENCES huddles(id) ON DELETE CASCADE,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  -- pending: awaiting one or both confirmations
  -- completed: both confirmed, ownership moved
  -- cancelled: superseded by a newer request for the same Huddle, or an
  --   expired one swept by a housekeeping job (none scheduled yet — expired
  --   requests are simply rejected as invalid when their token is used)
  -- failed: both confirmed, but execution couldn't complete (e.g. the
  --   recipient's plan no longer allows another Huddle) — see failure_reason
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Two separate tokens (not one) so the sender's and recipient's
  -- confirmation links are independent — neither party can use the other's
  -- link, and knowing one doesn't help guess the other.
  from_token UUID NOT NULL DEFAULT gen_random_uuid(),
  to_token UUID NOT NULL DEFAULT gen_random_uuid(),
  from_confirmed_at TIMESTAMP WITH TIME ZONE,
  to_confirmed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE huddle_transfer_requests ADD CONSTRAINT huddle_transfer_requests_status_check
    CHECK (status IN ('pending', 'completed', 'cancelled', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_huddle_transfer_requests_huddle_id ON huddle_transfer_requests (huddle_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_huddle_transfer_requests_from_token ON huddle_transfer_requests (from_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_huddle_transfer_requests_to_token ON huddle_transfer_requests (to_token);

ALTER TABLE huddle_transfer_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role can manage huddle transfer requests" ON huddle_transfer_requests
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
