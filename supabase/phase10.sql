-- Mythos Phase 10 schema delta — chapter freshness: persistent, bounded
-- story memory (arc summary, motif lexicon, recent openings).
-- Additive only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.
--
-- All three memory fields are bounded in application code (see
-- src/lib/ai.ts and src/lib/story-memory.ts) regardless of how many
-- chapters a user has: arc_summary is capped at ~150 words, motifs is
-- capped at 12 entries (least-recently-seen evicted), recent_openings is
-- capped at 5. No query ever loads full chapter history into a prompt.

create table if not exists story_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  arc_summary text not null default '',
  motifs jsonb not null default '[]',
  recent_openings text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table story_state enable row level security;

drop policy if exists "story_state_select_own" on story_state;
create policy "story_state_select_own" on story_state
  for select using (user_id = auth.uid());
drop policy if exists "story_state_insert_own" on story_state;
create policy "story_state_insert_own" on story_state
  for insert with check (user_id = auth.uid());
drop policy if exists "story_state_update_own" on story_state;
create policy "story_state_update_own" on story_state
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "story_state_delete_own" on story_state;
create policy "story_state_delete_own" on story_state
  for delete using (user_id = auth.uid());
