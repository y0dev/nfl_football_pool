-- League roster members don't require an email — a commissioner may add
-- someone they'll notify manually instead. Run this after
-- add-huddle-members.sql. Safe to re-run (dropping NOT NULL on an already-
-- nullable column is a no-op in Postgres).

ALTER TABLE huddle_members ALTER COLUMN email DROP NOT NULL;

-- Note: the UNIQUE (huddle_id, email) constraint from add-huddle-members.sql
-- is untouched and still correct — Postgres treats each NULL as distinct,
-- so multiple no-email members in the same League are allowed.
