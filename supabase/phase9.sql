-- Mythos Phase 9 schema delta — best-effort per-user rate limiting.
-- Additive only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.
--
-- This table backs a best-effort throttle on the expensive AI-calling
-- actions (chapter generation, Book generation) — see src/lib/rate-limit.ts
-- for why it's "best-effort" and not a real abuse defense.

create table if not exists generation_throttle (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_chapter_request_at timestamptz,
  last_book_request_at timestamptz
);

alter table generation_throttle enable row level security;

drop policy if exists "generation_throttle_select_own" on generation_throttle;
create policy "generation_throttle_select_own" on generation_throttle
  for select using (user_id = auth.uid());
drop policy if exists "generation_throttle_insert_own" on generation_throttle;
create policy "generation_throttle_insert_own" on generation_throttle
  for insert with check (user_id = auth.uid());
drop policy if exists "generation_throttle_update_own" on generation_throttle;
create policy "generation_throttle_update_own" on generation_throttle
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
