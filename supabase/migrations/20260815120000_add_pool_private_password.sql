-- Mandatory password protection for private pools. `pools.is_private` and
-- `pools.join_password` already existed but only ever gated the *join*
-- flow (/api/pools/join) — anyone with a pool link could already view
-- picks/leaderboard/results with no password at all. This adds a
-- dedicated, encrypted password for the new view-access gate
-- (src/lib/pool-access.ts), kept separate from the legacy plaintext
-- `join_password` so public pools' existing optional join-password
-- behavior is completely untouched.
--
-- private_password_encrypted stores AES-256-GCM ciphertext (base64), never
-- plaintext — decryptable only server-side (POOL_ACCESS_SECRET env var),
-- so the commissioner can still recover it for the share message.
-- private_password_version increments on every password change; the
-- signed access cookie embeds the version it was issued under, so
-- changing the password invalidates every previously-issued cookie
-- without needing a cookie blocklist.

ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS private_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS private_password_version INTEGER NOT NULL DEFAULT 0;
