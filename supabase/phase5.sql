-- Mythos Phase 5 schema delta — the morning auto-writer.
-- Additive, nullable/defaulted columns only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.

-- 1. profiles: lets a user opt out of the overnight auto-writer. Defaults to
--    true so existing users are opted in; the UI toggle on /character lets
--    them turn it off.
alter table profiles add column if not exists auto_chapter boolean not null default true;

-- 2. chapters: records whether a chapter was written by the cron job or by
--    the user clicking "Begin today's chapter", so the UI can show a small
--    marker and so this is auditable later.
alter table chapters add column if not exists generated_by text not null default 'manual';
