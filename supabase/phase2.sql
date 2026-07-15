-- Mythos Phase 2 schema delta
-- Additive, nullable columns only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.

alter table chapters add column if not exists reflection text;
alter table chapters add column if not exists reflection_extracted jsonb;
alter table chapters add column if not exists reflected_at timestamptz;
alter table profiles add column if not exists timezone text;
