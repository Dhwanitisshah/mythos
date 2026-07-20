-- Mythos canonical schema (Phase 1 + Phase 2 + Phase 3)
-- Paste this entire file into the Supabase SQL editor and run it.

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  identity jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  timezone text,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references goals (id) on delete cascade,
  chapter_number int not null,
  title text not null,
  narrative text not null,
  quests jsonb not null default '[]'::jsonb,
  reflection text,
  reflection_extracted jsonb,
  reflected_at timestamptz,
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

create index if not exists goals_user_id_idx on goals (user_id);
create index if not exists chapters_user_id_idx on chapters (user_id);
create index if not exists chapters_goal_id_idx on chapters (goal_id);
create index if not exists stat_events_user_id_idx on stat_events (user_id);

-- Row Level Security: each user may only read/write their own rows.

alter table profiles enable row level security;
alter table goals enable row level security;
alter table chapters enable row level security;
alter table stats enable row level security;
alter table stat_events enable row level security;

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
