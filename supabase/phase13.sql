-- Mythos Phase 13 schema delta — character avatars (DiceBear) in a rank frame.
-- Additive only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.
--
-- The avatar SVG itself is never stored — it's regenerated on every render
-- from (avatar_style, avatar_seed) via src/lib/avatar.ts, same reasoning as
-- every other derived value in this schema. Both columns are nullable: a
-- null avatar_style falls back to DEFAULT_AVATAR_STYLE in code, and a null
-- avatar_seed falls back to the user's own id — so existing rows created
-- before this migration render a sensible default with no backfill needed.

alter table profiles add column if not exists avatar_style text;
alter table profiles add column if not exists avatar_seed text;
