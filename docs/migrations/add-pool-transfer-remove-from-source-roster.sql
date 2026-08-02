-- Follow-up for add-pool-transfer-requests.sql: adds the
-- remove_from_source_roster column, for the "also remove these
-- participants from my League roster" checkbox on the pool transfer flow
-- (initiatePoolTransfer / confirmPoolTransfer in
-- src/actions/poolTransfers.ts).
--
-- Skip this if you're running add-pool-transfer-requests.sql for the first
-- time — it already includes this column. Safe to re-run either way
-- (ADD COLUMN IF NOT EXISTS is a no-op once applied).

ALTER TABLE pool_transfer_requests
  ADD COLUMN IF NOT EXISTS remove_from_source_roster BOOLEAN NOT NULL DEFAULT false;
