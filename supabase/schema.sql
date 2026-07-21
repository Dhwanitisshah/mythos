-- Mythos canonical schema (Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 + Phase 7)
-- Paste this entire file into the Supabase SQL editor and run it.
--
-- Phase 4 (kingdoms) note: the six life domains a goal can belong to are NOT
-- a DB table — they're a fixed, code-level lookup (src/lib/kingdoms.ts).
-- There are exactly six of them and they never vary per user, so a table
-- would just add RLS + a join for no benefit.
--
-- Phase 5 (morning auto-writer) note: the cron route that generates chapters
-- overnight runs with NO user session, so it uses the Supabase service role
-- key (src/utils/supabase/admin.ts) which bypasses RLS entirely. Every query
-- in that code path filters by user_id explicitly in application code.
--
-- Phase 6 (visual identity) note: purely CSS/component work, no schema delta.
--
-- Phase 7 (the Book) note: period summaries are derived entirely from
-- existing chapters/stat_events/goals — no new source-of-truth tables, just
-- the `books` table below to persist the generated summary itself.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  identity jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  timezone text,
  auto_chapter boolean not null default true, -- Phase 5: opt out of overnight auto-writer
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null,
  kingdom text, -- Phase 4: one of the six kingdom keys, see src/lib/kingdoms.ts
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references goals (id) on delete cascade, -- Phase 4: nullable, a chapter can span kingdoms
  chapter_number int not null, -- Phase 4: numbered per-user, was per-goal before
  title text not null,
  narrative text not null,
  quests jsonb not null default '[]'::jsonb, -- Phase 4: items may carry an optional "kingdom" field
  reflection text,
  reflection_extracted jsonb,
  reflected_at timestamptz,
  generated_by text not null default 'manual', -- Phase 5: 'manual' | 'auto'
  created_at timestamptz not null default now()
);

create table if not exists stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discipline int not null default 10,
  strength   int not null default 10,
  wisdom     int not null default 10,
  calm       int not null default 10,
  honor      int not null default 10,
  charisma   int not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists stat_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid references chapters (id) on delete cascade,
  stat text not null,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

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

create index if not exists goals_user_id_idx on goals (user_id);
create index if not exists goals_kingdom_idx on goals (kingdom);
create index if not exists chapters_user_id_idx on chapters (user_id);
create index if not exists chapters_goal_id_idx on chapters (goal_id);
create index if not exists stat_events_user_id_idx on stat_events (user_id);
create index if not exists books_user_id_idx on books (user_id);

-- Row Level Security: each user may only read/write their own rows.

alter table profiles enable row level security;
alter table goals enable row level security;
alter table chapters enable row level security;
alter table stats enable row level security;
alter table stat_events enable row level security;
alter table books enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles_delete_own" on profiles;
create policy "profiles_delete_own" on profiles
  for delete using (id = auth.uid());

drop policy if exists "goals_select_own" on goals;
create policy "goals_select_own" on goals
  for select using (user_id = auth.uid());
drop policy if exists "goals_insert_own" on goals;
create policy "goals_insert_own" on goals
  for insert with check (user_id = auth.uid());
drop policy if exists "goals_update_own" on goals;
create policy "goals_update_own" on goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "goals_delete_own" on goals;
create policy "goals_delete_own" on goals
  for delete using (user_id = auth.uid());

drop policy if exists "chapters_select_own" on chapters;
create policy "chapters_select_own" on chapters
  for select using (user_id = auth.uid());
drop policy if exists "chapters_insert_own" on chapters;
create policy "chapters_insert_own" on chapters
  for insert with check (user_id = auth.uid());
drop policy if exists "chapters_update_own" on chapters;
create policy "chapters_update_own" on chapters
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "chapters_delete_own" on chapters;
create policy "chapters_delete_own" on chapters
  for delete using (user_id = auth.uid());

drop policy if exists "stats_select_own" on stats;
create policy "stats_select_own" on stats
  for select using (user_id = auth.uid());
drop policy if exists "stats_insert_own" on stats;
create policy "stats_insert_own" on stats
  for insert with check (user_id = auth.uid());
drop policy if exists "stats_update_own" on stats;
create policy "stats_update_own" on stats
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "stats_delete_own" on stats;
create policy "stats_delete_own" on stats
  for delete using (user_id = auth.uid());

drop policy if exists "stat_events_select_own" on stat_events;
create policy "stat_events_select_own" on stat_events
  for select using (user_id = auth.uid());
drop policy if exists "stat_events_insert_own" on stat_events;
create policy "stat_events_insert_own" on stat_events
  for insert with check (user_id = auth.uid());

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
