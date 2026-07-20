"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  extractReflection,
  generateChapter,
  STAT_NAMES,
  type Identity,
  type PreviousContext,
  type Quest,
  type ReflectionExtracted,
  type StatName,
} from "@/lib/ai";

const STAT_MIN = 0;
const STAT_MAX = 100;

function clampStat(value: number): number {
  return Math.min(STAT_MAX, Math.max(STAT_MIN, value));
}

async function applyStatChanges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chapterId: string,
  statChanges: ReflectionExtracted["statChanges"],
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

export async function beginTodaysChapter(goalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("identity")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Could not load your profile");
  }

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, title, category")
    .eq("id", goalId)
    .single();

  if (goalError || !goal) {
    throw new Error("Could not load your goal");
  }

  const { count, error: countError } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", goal.id);

  if (countError) {
    throw new Error("Could not determine the next chapter number");
  }

  const chapterNumber = (count ?? 0) + 1;

  const { data: priorChapters, error: priorError } = await supabase
    .from("chapters")
    .select("title, reflection_extracted")
    .eq("goal_id", goal.id)
    .not("reflection_extracted", "is", null)
    .order("chapter_number", { ascending: false })
    .limit(1);

  if (priorError) {
    throw new Error("Could not load prior chapter memory");
  }

  const priorChapter = priorChapters?.[0] ?? null;
  const previousContext: PreviousContext = priorChapter
    ? (() => {
        const extracted = priorChapter.reflection_extracted as ReflectionExtracted;
        return {
          title: priorChapter.title,
          summary: extracted.summary,
          wins: extracted.wins,
          setbacks: extracted.setbacks,
        };
      })()
    : null;

  const chapter = await generateChapter({
    identity: profile.identity as Identity,
    goal: { title: goal.title, category: goal.category },
    chapterNumber,
    previousContext,
  });

  const { error: insertError } = await supabase.from("chapters").insert({
    user_id: user.id,
    goal_id: goal.id,
    chapter_number: chapterNumber,
    title: chapter.title,
    narrative: chapter.narrative,
    quests: chapter.quests,
  });

  if (insertError) {
    throw new Error(`Failed to save chapter: ${insertError.message}`);
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
  if (!quests[questIndex]) {
    throw new Error("Quest not found");
  }

  quests[questIndex] = { ...quests[questIndex], done: !quests[questIndex].done };

  const { error: updateError } = await supabase
    .from("chapters")
    .update({ quests })
    .eq("id", chapterId);

  if (updateError) {
    throw new Error(`Failed to update quest: ${updateError.message}`);
  }

  revalidatePath("/journey");
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

  let statsError: string | null = null;
  try {
    await applyStatChanges(supabase, user.id, chapterId, extracted.statChanges);
  } catch (err) {
    statsError = err instanceof Error ? err.message : "Failed to update stats";
  }

  revalidatePath("/journey");
  revalidatePath("/character");

  return { statChanges: extracted.statChanges, statsError };
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
