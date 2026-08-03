-- Account Settings feature (Google link/unlink, notification preferences).
-- Run in the Supabase SQL editor before deploying this feature — the new
-- routes read/write these columns immediately.

-- Decoupled from password_hash's 'google_oauth' sentinel on purpose: an
-- account can now have BOTH a real password AND Google linked at the same
-- time, which a single column can't represent.
ALTER TABLE commissioners ADD COLUMN IF NOT EXISTS google_linked BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing Google-only account (created via the old
-- sentinel-only model) should show up as linked, or they'd lose the
-- ability to sign in with Google the moment this ships.
UPDATE commissioners SET google_linked = true WHERE password_hash = 'google_oauth';

ALTER TABLE commissioners ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL
  DEFAULT '{"pick_reminders":true,"weekly_summaries":true,"season_announcements":true,"product_updates":true}'::jsonb;

-- Verify:
SELECT email, password_hash = 'google_oauth' AS was_sentinel, google_linked FROM commissioners;
