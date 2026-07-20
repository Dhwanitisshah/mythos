-- Mythos Phase 3 schema delta
-- Additive, safe on existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.

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

create index if not exists stat_events_user_id_idx on stat_events (user_id);

-- Row Level Security: each user may only read/write their own rows.

alter table stats enable row level security;
alter table stat_events enable row level security;

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
