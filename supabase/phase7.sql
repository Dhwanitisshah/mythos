-- Mythos Phase 7 schema delta — the Book: AI-authored period summaries.
-- Additive only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  title text not null,
  narrative text not null,
  stats_snapshot jsonb not null,      -- the six stats and their net change over the period
  source_chapter_ids uuid[] not null, -- provenance: exactly which chapters fed this Book
  created_at timestamptz not null default now(),
  constraint books_user_period_unique unique (user_id, period_start, period_end)
);

create index if not exists books_user_id_idx on books (user_id);

alter table books enable row level security;

drop policy if exists "books_select_own" on books;
create policy "books_select_own" on books
  for select using (user_id = auth.uid());
drop policy if exists "books_insert_own" on books;
create policy "books_insert_own" on books
  for insert with check (user_id = auth.uid());
drop policy if exists "books_update_own" on books;
create policy "books_update_own" on books
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "books_delete_own" on books;
create policy "books_delete_own" on books
  for delete using (user_id = auth.uid());
