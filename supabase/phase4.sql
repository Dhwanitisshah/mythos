-- Mythos Phase 4 schema delta — kingdoms: multiple parallel goals across life
-- domains, one unified daily chapter.
-- Paste this entire file into the Supabase SQL editor and run it.
--
-- Safety summary:
--   - Steps 1 and 2 are additive/nullable-column changes. Safe on existing rows,
--     nothing is deleted.
--   - Step 3 is a ONE-TIME UPDATE that OVERWRITES existing chapter_number values
--     so numbering becomes per-user instead of per-goal. No rows are deleted or
--     added, but the old per-goal numbers are not recoverable after this runs.
--     If you want to keep a record of the old numbers, export the `chapters`
--     table first.
--   - Step 4 is a no-op comment: chapters.quests jsonb items may now carry an
--     optional "kingdom" field, but existing rows are NOT rewritten — the app
--     treats a quest with no "kingdom" key as unassigned.
--
-- Why kingdoms are not a table: there are exactly six fixed life domains and
-- they never vary per user, so a `kingdoms` table would add RLS policies and a
-- join for zero real benefit. They live as a static TS constant instead, see
-- src/lib/kingdoms.ts.

-- 1. goals: add kingdom, backfilled from the existing category column.
--    category is left in place (still NOT NULL, still populated going forward)
--    so nothing that reads it breaks.
alter table goals add column if not exists kingdom text;

update goals
set kingdom = category
where kingdom is null
  and category in ('fitness', 'learning', 'relationships', 'career', 'money', 'mind');

create index if not exists goals_kingdom_idx on goals (kingdom);

-- 2. chapters: goal_id becomes nullable — a chapter can now span several
--    kingdoms/goals instead of belonging to exactly one. Existing values are
--    untouched; only new chapters will insert NULL here.
alter table chapters alter column goal_id drop not null;

-- 3. chapters: chapter_number becomes per-user instead of per-goal.
--    ONE-TIME RENUMBER of existing rows: 1..N per user, ordered by
--    created_at ascending, so your current chapters keep a sane, gap-free
--    sequence. This OVERWRITES chapter_number on existing rows (see safety
--    summary above) — it does not touch any other column and deletes nothing.
with numbered as (
  select id, row_number() over (partition by user_id order by created_at asc) as rn
  from chapters
)
update chapters
set chapter_number = numbered.rn
from numbered
where chapters.id = numbered.id;

-- 4. chapters.quests jsonb items may now include an optional "kingdom" field:
--    { text, done, kingdom? }. This is a schemaless jsonb column, so no ALTER
--    is needed — existing quest objects simply lack the field, and app code
--    (see src/app/journey/quest-checklist.tsx) treats that as "unassigned".
