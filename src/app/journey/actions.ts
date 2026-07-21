"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  extractReflection,
  KINGDOM_STAT,
  STAT_NAMES,
  type Quest,
  type StatChange,
  type StatName,
} from "@/lib/ai";
import { generateDailyChapter } from "@/lib/generate-daily-chapter";

const STAT_MIN = 0;
const STAT_MAX = 100;

function clampStat(value: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, value));
}

async function applyStatChanges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chapterId: string,
  statChanges: StatChange[],
): Promise<void> {
  if (statChanges.length === 0) return;

  const { error: upsertError } = await supabase
    .from("stats")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (upsertError) {
    throw new Error(`Failed to initialize stats: ${upsertError.message}`);
  }

  const { data: statsRow, error: fetchError } = await supabase
    .from("stats")
    .select(STAT_NAMES.join(","))
    .eq("user_id", userId)
    .single();

  if (fetchError || !statsRow) {
    throw new Error("Failed to load stats");
  }

  const current = statsRow as unknown as Record<StatName, number>;
  const updates: Record<StatName, number> = { ...current };

  for (const change of statChanges) {
    updates[change.stat] = clampStat(updates[change.stat] + change.delta);
  }

  const { error: eventsError } = await supabase.from("stat_events").insert(
    statChanges.map((change) => ({
      user_id: userId,
      chapter_id: chapterId,
      stat: change.stat,
      delta: change.delta,
      reason: change.reason,
    })),
  );

  if (eventsError) {
    throw new Error(`Failed to record stat events: ${eventsError.message}`);
  }

  const { error: updateStatsError } = await supabase
    .from("stats")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updateStatsError) {
    throw new Error(`Failed to update stats: ${updateStatsError.message}`);
  }
}

export async function beginTodaysChapter() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await generateDailyChapter(supabase, user.id, "manual");

  switch (result.status) {
    case "created":
      break;
    case "skipped-already-exists":
      // The UI only shows this button when there's no chapter for today;
      // treat a race as a no-op rather than an error.
      break;
    case "skipped-no-goals":
      throw new Error("You don't have any active goals yet — set one in Kingdoms first.");
    case "error":
      throw new Error(result.message);
  }

  revalidatePath("/journey");
}

export async function toggleQuest(chapterId: string, questIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: chapter, error: fetchError } = await supabase
    .from("chapters")
    .select("quests")
    .eq("id", chapterId)
    .single();

  if (fetchError || !chapter) {
    throw new Error("Could not load chapter");
  }

  const quests = chapter.quests as Quest[];
  const quest = quests[questIndex];
  if (!quest) {
    throw new Error("Quest not found");
  }

  const nowDone = !quest.done;
  quests[questIndex] = { ...quest, done: nowDone };

  const { error: updateError } = await supabase
    .from("chapters")
    .update({ quests })
    .eq("id", chapterId);

  if (updateError) {
    throw new Error(`Failed to update quest: ${updateError.message}`);
  }

  let statsError: string | null = null;
  if (quest.kingdom) {
    const stat = KINGDOM_STAT[quest.kingdom];
    const delta = nowDone ? 1 : -1;
    const reason = nowDone
      ? `Completed quest: "${quest.text}"`
      : `Reopened quest: "${quest.text}"`;

    try {
      await applyStatChanges(supabase, user.id, chapterId, [{ stat, delta, reason }]);
    } catch (err) {
      statsError = err instanceof Error ? err.message : "Failed to update stats";
    }
  }

  revalidatePath("/journey");
  revalidatePath("/character");

  return { statsError };
}

export async function submitReflection(chapterId: string, text: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Reflection cannot be empty");
  }

  const { data: existingChapter, error: existingError } = await supabase
    .from("chapters")
    .select("reflected_at")
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .single();

  if (existingError || !existingChapter) {
    throw new Error("Could not load chapter");
  }

  if (existingChapter.reflected_at) {
    throw new Error("This chapter has already been reflected on");
  }

  const extracted = await extractReflection(trimmed);

  const { error: updateError } = await supabase
    .from("chapters")
    .update({
      reflection: trimmed,
      reflection_extracted: extracted,
      reflected_at: new Date().toISOString(),
    })
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .is("reflected_at", null);

  if (updateError) {
    throw new Error(`Failed to save reflection: ${updateError.message}`);
  }

  revalidatePath("/journey");
}

export async function setProfileTimezone(timezone: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!timezone.trim()) {
    return;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(`Failed to save timezone: ${updateError.message}`);
  }

  revalidatePath("/journey");
}

export async function setAutoChapter(autoChapter: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ auto_chapter: autoChapter })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(`Failed to save preference: ${updateError.message}`);
  }

  revalidatePath("/character");
}
