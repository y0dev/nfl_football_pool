-- Commissioners split — run this in the Supabase SQL editor (sandbox project).
-- Creates `commissioners` + `payments`, and drops the now-invalid FK
-- constraints on audit_logs.admin_id / reminder_logs.sent_by (a single
-- column can't cleanly reference two disjoint tables now that admin_id can
-- mean "either an admins row or a commissioners row").
--
-- This is the DDL half only — it does NOT move any rows out of `admins` or
-- delete anything. Once this has been run, tell Claude and the data-copy
-- step (INSERT INTO commissioners ... FROM admins; DELETE FROM admins ...)
-- will be run programmatically via the app's normal Supabase client, the
-- same way every other data operation in this app works.
--
-- Safe to re-run: every statement is IF NOT EXISTS / IF EXISTS / OR REPLACE.

-- 1. commissioners — same shape as admins minus is_super_admin. id is NOT
--    auto-generated independently here; the data-copy step preserves each
--    commissioner's existing admins.id so nothing currently logged in gets
--    invalidated.
CREATE TABLE IF NOT EXISTS commissioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  plan VARCHAR(20) DEFAULT 'free',
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  billing_exempt BOOLEAN NOT NULL DEFAULT false,
  addon_pools INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(255)
);

ALTER TABLE commissioners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Commissioners can view their own profile" ON commissioners;
CREATE POLICY "Commissioners can view their own profile" ON commissioners
  FOR SELECT USING (
    id = auth.uid()
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Service role can manage commissioners" ON commissioners;
CREATE POLICY "Service role can manage commissioners" ON commissioners
  FOR ALL USING (auth.role() = 'service_role');

-- 2. payments — didn't exist at all yet in this sandbox (confirmed earlier
--    this week). References commissioners(id), not admins(id) — billing is
--    commissioner-only. Column stays named admin_id to match every existing
--    call site written against it.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES commissioners(id) ON DELETE SET NULL,
  stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_intent VARCHAR(255),
  product VARCHAR(30) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_cents INTEGER,
  currency VARCHAR(10) DEFAULT 'usd',
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage payments" ON payments;
CREATE POLICY "Service role can manage payments" ON payments
  FOR ALL USING (auth.role() = 'service_role');

-- 3. audit_logs / reminder_logs — drop the FK constraint on the columns
--    that now mean "either table", keep the column (plain UUID, no
--    referential integrity enforced — these are best-effort log columns,
--    already ON DELETE SET NULL, not worth a dual-FK or role-tag column).
--    Default Postgres constraint names for an inline, unnamed FK.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;
ALTER TABLE reminder_logs DROP CONSTRAINT IF EXISTS reminder_logs_sent_by_fkey;

-- Verification: should show admin_id/sent_by still exist as plain uuid
-- columns with no foreign key.
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name IN ('audit_logs','reminder_logs') AND column_name IN ('admin_id','sent_by');
