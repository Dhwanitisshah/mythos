import type { SupabaseClient } from "@supabase/supabase-js";
import type { KingdomKey } from "@/lib/kingdoms";

// Phase 11: grounded world simulation. Prosperity moves ONLY from real
// activity — completed quests raise it, sustained neglect lowers it. Never
// invented. See supabase/phase11.sql for the kingdom_state table.

export const QUEST_PROSPERITY_DELTA = 4;
export const DECAY_PROSPERITY_DELTA = 3;
export const DECAY_NEGLECT_DAYS = 3;
const DEFAULT_PROSPERITY = 50;

function clampProsperity(value: number): number {
  return Math.min(100, Math.max(0, value));
}

type KingdomStateRow = {
  prosperity: number;
  last_activity_on: string | null;
  last_decayed_on: string | null;
};

async function readKingdomState(
  supabase: SupabaseClient,
  userId: string,
  kingdom: KingdomKey,
): Promise<KingdomStateRow | null> {
  const { data, error } = await supabase
    .from("kingdom_state")
    .select("prosperity, last_activity_on, last_decayed_on")
    .eq("user_id", userId)
    .eq("kingdom", kingdom)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read kingdom_state (${kingdom}): ${error.message}`);
  }

  return data;
}

// Called from toggleQuest (src/app/journey/actions.ts) when a kingdom-tagged
// quest is completed or reopened. RLS gotcha: does NOT chain .select() on
// the write — an INSERT...RETURNING must also pass a SELECT policy, which
// complicates upsert — so the current value is read separately first, and
// the computed result is written without returning it.
export async function applyQuestToggleToKingdomState(
  supabase: SupabaseClient,
  userId: string,
  kingdom: KingdomKey,
  nowDone: boolean,
  localToday: string,
): Promise<void> {
  const existing = await readKingdomState(supabase, userId, kingdom);
  const current = existing?.prosperity ?? DEFAULT_PROSPERITY;
  const next = clampProsperity(
    current + (nowDone ? QUEST_PROSPERITY_DELTA : -QUEST_PROSPERITY_DELTA),
  );

  const payload: Record<string, unknown> = {
    user_id: userId,
    kingdom,
    prosperity: next,
    updated_at: new Date().toISOString(),
  };
  // Only completing (not reopening) counts as fresh activity — mirrors the
  // asymmetry already used for stat changes elsewhere in toggleQuest.
  if (nowDone) {
    payload.last_activity_on = localToday;
  }

  const { error } = await supabase
    .from("kingdom_state")
    .upsert(payload, { onConflict: "user_id,kingdom" });

  if (error) {
    throw new Error(`Failed to update kingdom_state (${kingdom}): ${error.message}`);
  }
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`);
  const to = new Date(`${toDateStr}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

// Called from the nightly cron route for each kingdom with an active goal.
// Applies at most one decay per kingdom per local day, guarded by
// last_decayed_on — safe to call more than once for the same day (Vercel
// cron delivery is at-least-once, same idempotency concern as
// generateDailyChapter's own "already exists today" check).
export async function applyNightlyDecay(
  supabase: SupabaseClient,
  userId: string,
  kingdom: KingdomKey,
  localToday: string,
): Promise<"decayed" | "skipped"> {
  const existing = await readKingdomState(supabase, userId, kingdom);
  // No row at all means no activity has ever been recorded for this
  // kingdom — nothing to decay from yet.
  if (!existing || !existing.last_activity_on) return "skipped";

  if (existing.last_decayed_on && existing.last_decayed_on >= localToday) {
    return "skipped";
  }

  if (daysBetween(existing.last_activity_on, localToday) <= DECAY_NEGLECT_DAYS) {
    return "skipped";
  }

  const next = clampProsperity(existing.prosperity - DECAY_PROSPERITY_DELTA);

  const { error } = await supabase.from("kingdom_state").upsert(
    {
      user_id: userId,
      kingdom,
      prosperity: next,
      last_decayed_on: localToday,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,kingdom" },
  );

  if (error) {
    throw new Error(`Failed to apply decay to kingdom_state (${kingdom}): ${error.message}`);
  }

  return "decayed";
}
