-- Mythos canonical schema (Phase 1 + Phase 2)
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

create index if not exists goals_user_id_idx on goals (user_id);
create index if not exists chapters_user_id_idx on chapters (user_id);
create index if not exists chapters_goal_id_idx on chapters (goal_id);

-- Row Level Security: each user may only read/write their own rows.

alter table profiles enable row level security;
alter table goals enable row level security;
alter table chapters enable row level security;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_delete_own" on profiles
  for delete using (id = auth.uid());

create policy "goals_select_own" on goals
  for select using (user_id = auth.uid());
create policy "goals_insert_own" on goals
  for insert with check (user_id = auth.uid());
create policy "goals_update_own" on goals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals_delete_own" on goals
  for delete using (user_id = auth.uid());

create policy "chapters_select_own" on chapters
  for select using (user_id = auth.uid());
create policy "chapters_insert_own" on chapters
  for insert with check (user_id = auth.uid());
create policy "chapters_update_own" on chapters
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "chapters_delete_own" on chapters
  for delete using (user_id = auth.uid());
