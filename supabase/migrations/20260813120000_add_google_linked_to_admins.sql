-- admins (super-admins) never got the google_linked column that
-- commissioners has (see src/lib/supabase.ts commissionersTable). Any
-- Google sign-in/link/self-heal write against an admins row that targets
-- google_linked (src/app/auth/callback/route.ts, via src/lib/accounts.ts)
-- fails with "column does not exist". Super-admins are always created with
-- a real password, never self-registered via Google, so this stayed latent
-- until audited — but the read/write paths treat both tables identically,
-- so the gap is real.

ALTER TABLE admins ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any admin row whose password_hash is still the 'google_oauth'
-- sentinel is Google-linked in all but name — same rule commissioners'
-- self-heal already applies.
UPDATE admins SET google_linked = true WHERE password_hash = 'google_oauth' AND google_linked = false;
