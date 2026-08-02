-- Add optional join password to pools table
-- Run this in the Supabase SQL editor before deploying the pool search feature.

ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS join_password TEXT;

-- Commissioners can set a password when creating a pool.
-- NULL means open access (anyone can join from the public search page).
-- Non-NULL means the participant must supply the correct password to join.
