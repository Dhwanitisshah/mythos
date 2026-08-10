-- Mythos Phase 11 schema delta — grounded world simulation: kingdoms
-- persistently prosper or decay based on REAL activity.
-- Additive only — safe to run against existing rows.
-- Paste this entire file into the Supabase SQL editor and run it.
--
-- The "condition" label (Flourishing / Steady / Waning / Fallow) is
-- DERIVED IN CODE from prosperity (src/lib/kingdoms.ts,
-- conditionForProsperity) — deliberately not a DB view, since views bypass
-- RLS unless security_invoker is explicitly set, and it's not worth the
-- extra surface for a pure display mapping.

create table if not exists kingdom_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  kingdom text not null,
  prosperity int not null default 50,
  last_activity_on date,
  last_decayed_on date,
  updated_at timestamptz not null default now(),
  primary key (user_id, kingdom)
);

alter table kingdom_state enable row level security;

drop policy if exists "kingdom_state_select_own" on kingdom_state;
create policy "kingdom_state_select_own" on kingdom_state
  for select using (user_id = auth.uid());
drop policy if exists "kingdom_state_insert_own" on kingdom_state;
create policy "kingdom_state_insert_own" on kingdom_state
  for insert with check (user_id = auth.uid());
drop policy if exists "kingdom_state_update_own" on kingdom_state;
create policy "kingdom_state_update_own" on kingdom_state
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "kingdom_state_delete_own" on kingdom_state;
create policy "kingdom_state_delete_own" on kingdom_state
  for delete using (user_id = auth.uid());
