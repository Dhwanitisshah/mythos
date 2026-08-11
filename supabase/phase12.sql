-- Mythos Phase 12 schema delta — Rank & Ascension.
-- Additive only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.
--
-- Power Level and Rank tier are DERIVED IN CODE from the real record — the
-- six stats plus average kingdom prosperity (src/lib/rank.ts,
-- computePowerLevel / rankFor) — deliberately not a DB view, same rationale
-- as conditionForProsperity in Phase 11: views bypass RLS unless
-- security_invoker is explicitly set, and it's not worth the extra surface
-- for a pure display mapping.
--
-- The only new state is `last_acknowledged_tier`: which tier the user has
-- already seen the ascension reveal for, so it fires exactly once per tier
-- crossed rather than every page load.

alter table profiles add column if not exists last_acknowledged_tier text;
