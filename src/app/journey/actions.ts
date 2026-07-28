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
import { checkAndClaimThrottle } from "@/lib/rate-limit";

const CHAPTER_THROTTLE_SECONDS = 30;

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

export type BeginChapterResult =
  | { ok: true }
  | {
      ok: false;
      reason: "no-active-goals" | "rate-limited" | "generation-failed";
      message: string;
    };

export async function beginTodaysChapter(): Promise<BeginChapterResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const throttle = await checkAndClaimThrottle(
    supabase,
    user.id,
    "last_chapter_request_at",
    CHAPTER_THROTTLE_SECONDS,
  );
  if (throttle.limited) {
    return {
      ok: false,
      reason: "rate-limited",
      message: `You just tried this — wait ${throttle.retryAfterSeconds}s and try again.`,
    };
  }

  const result = await generateDailyChapter(supabase, user.id, "manual");

  switch (result.status) {
    case "created":
    case "skipped-already-exists":
      // The UI only shows this button when there's no chapter for today;
      // treat a race as a no-op rather than an error.
      revalidatePath("/journey");
      return { ok: true };
    case "skipped-no-goals":
      return {
        ok: false,
        reason: "no-active-goals",
        message: "You don't have any active goals yet — set one in Kingdoms first.",
      };
    case "error":
      return { ok: false, reason: "generation-failed", message: result.message };
  }
}

export type ToggleQuestResult =
  | { ok: true; statsError: string | null }
  | {
      ok: false;
      reason: "chapter-not-found" | "quest-not-found" | "update-failed";
      message: string;
    };

export async function toggleQuest(
  chapterId: string,
  questIndex: number,
): Promise<ToggleQuestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!Number.isInteger(questIndex) || questIndex < 0) {
    return {
      ok: false,
      reason: "quest-not-found",
      message: "That quest could not be found. Try refreshing the page.",
    };
  }

  const { data: chapter, error: fetchError } = await supabase
    .from("chapters")
    .select("quests")
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !chapter) {
    return {
      ok: false,
      reason: "chapter-not-found",
      message: "Could not load this chapter. Try refreshing the page.",
    };
  }

  const quests = chapter.quests as Quest[];
  const quest = quests[questIndex];
  if (!quest) {
    return {
      ok: false,
      reason: "quest-not-found",
      message: "That quest could not be found. Try refreshing the page.",
    };
  }

  const nowDone = !quest.done;
  quests[questIndex] = { ...quest, done: nowDone };

  const { error: updateError } = await supabase
    .from("chapters")
    .update({ quests })
    .eq("id", chapterId)
    .eq("user_id", user.id);

  if (updateError) {
    return {
      ok: false,
      reason: "update-failed",
      message: "Could not save that change. Try again.",
    };
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

  return { ok: true, statsError };
}

export type SubmitReflectionResult =
  | { ok: true }
  | {
      ok: false;
      reason: "empty" | "too-long" | "chapter-not-found" | "already-reflected" | "generation-failed" | "save-failed";
      message: string;
    };

const MAX_REFLECTION_LENGTH = 4000;

export async function submitReflection(
  chapterId: string,
  text: string,
): Promise<SubmitReflectionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty", message: "Write a few words about what happened." };
  }
  if (trimmed.length > MAX_REFLECTION_LENGTH) {
    return {
      ok: false,
      reason: "too-long",
      message: `Keep your reflection under ${MAX_REFLECTION_LENGTH} characters.`,
    };
  }

  const { data: existingChapter, error: existingError } = await supabase
    .from("chapters")
    .select("reflected_at")
    .eq("id", chapterId)
    .eq("user_id", user.id)
    .single();

  if (existingError || !existingChapter) {
    return {
      ok: false,
      reason: "chapter-not-found",
      message: "Could not load this chapter. Try refreshing the page.",
    };
  }

  if (existingChapter.reflected_at) {
    return {
      ok: false,
      reason: "already-reflected",
      message: "This chapter has already been reflected on.",
    };
  }

  let extracted;
  try {
    extracted = await extractReflection(trimmed);
  } catch {
    return {
      ok: false,
      reason: "generation-failed",
      message: "Couldn't process your reflection right now. Try again in a moment.",
    };
  }

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
    return {
      ok: false,
      reason: "save-failed",
      message: "Could not save your reflection. Try again.",
    };
  }

  revalidatePath("/journey");
  return { ok: true };
}

export type SetProfileTimezoneResult = { ok: true } | { ok: false; message: string };

const MAX_TIMEZONE_LENGTH = 100;

function isValidTimezone(value: string): boolean {
  if (value.length > MAX_TIMEZONE_LENGTH) return false;
  try {
    // Throws a RangeError for anything that isn't a real IANA timezone name.
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function setProfileTimezone(
  timezone: string,
): Promise<SetProfileTimezoneResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trimmed = timezone.trim();
  if (!trimmed) {
    return { ok: true };
  }

  if (!isValidTimezone(trimmed)) {
    return { ok: false, message: "That isn't a recognized timezone." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ timezone: trimmed })
    .eq("id", user.id);

  if (updateError) {
    return { ok: false, message: "Could not save timezone." };
  }

  revalidatePath("/journey");
  return { ok: true };
}

export type SetAutoChapterResult = { ok: true } | { ok: false; message: string };

export async function setAutoChapter(
  autoChapter: boolean,
): Promise<SetAutoChapterResult> {
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
    return { ok: false, message: "Could not save preference. Try again." };
  }

  revalidatePath("/character");
  return { ok: true };
}
