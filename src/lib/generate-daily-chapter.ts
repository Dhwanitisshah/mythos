import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateChapter,
  type GoalInput,
  type Identity,
  type PreviousContext,
  type Quest,
  type ReflectionExtracted,
} from "@/lib/ai";
import { isKingdomKey, type KingdomKey } from "@/lib/kingdoms";
import { isSameLocalDay } from "@/lib/timezone";

const NEGLECT_WINDOW_DAYS = 7;

export type GeneratedBy = "manual" | "auto";

export type GenerateDailyChapterResult =
  | { status: "created"; chapterId: string }
  | { status: "skipped-already-exists" }
  | { status: "skipped-no-goals" }
  | { status: "error"; message: string };

// Core chapter-generation logic shared by the interactive "Begin today's
// chapter" button (src/app/journey/actions.ts) and the overnight cron route
// (src/app/api/cron/daily-chapters/route.ts). Callers own auth: this
// function trusts the userId and supabase client it's given, and always
// filters by user_id explicitly since the cron path uses a service-role
// client that bypasses RLS.
export async function generateDailyChapter(
  supabase: SupabaseClient,
  userId: string,
  generatedBy: GeneratedBy,
): Promise<GenerateDailyChapterResult> {
  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("identity, timezone")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return { status: "error", message: "Could not load profile" };
    }

    const { data: latestChapters, error: latestError } = await supabase
      .from("chapters")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (latestError) {
      return { status: "error", message: "Could not check for an existing chapter" };
    }

    const latestChapter = latestChapters?.[0] ?? null;
    if (latestChapter && isSameLocalDay(latestChapter.created_at, profile.timezone)) {
      return { status: "skipped-already-exists" };
    }

    const { data: activeGoals, error: goalsError } = await supabase
      .from("goals")
      .select("id, title, kingdom")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (goalsError) {
      return { status: "error", message: "Could not load goals" };
    }

    const goals: GoalInput[] = (activeGoals ?? [])
      .filter((g) => isKingdomKey(g.kingdom))
      .map((g) => ({ title: g.title, kingdom: g.kingdom as KingdomKey }));

    if (goals.length === 0) {
      return { status: "skipped-no-goals" };
    }

    const { count, error: countError } = await supabase
      .from("chapters")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      return { status: "error", message: "Could not determine the next chapter number" };
    }

    const chapterNumber = (count ?? 0) + 1;

    const neglectWindowStart = new Date(
      Date.now() - NEGLECT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: recentChapters, error: recentError } = await supabase
      .from("chapters")
      .select("quests")
      .eq("user_id", userId)
      .gte("created_at", neglectWindowStart);

    if (recentError) {
      return { status: "error", message: "Could not determine kingdom activity" };
    }

    const completedKingdoms = new Set<string>();
    for (const chapter of recentChapters ?? []) {
      for (const quest of (chapter.quests as Quest[]) ?? []) {
        if (quest.done && quest.kingdom) {
          completedKingdoms.add(quest.kingdom);
        }
      }
    }

    const activeKingdoms = [...new Set(goals.map((g) => g.kingdom))];
    const neglectedKingdoms = activeKingdoms.filter((k) => !completedKingdoms.has(k));

    const { data: priorChapters, error: priorError } = await supabase
      .from("chapters")
      .select("title, reflection_extracted")
      .eq("user_id", userId)
      .not("reflection_extracted", "is", null)
      .order("chapter_number", { ascending: false })
      .limit(1);

    if (priorError) {
      return { status: "error", message: "Could not load prior chapter memory" };
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
      goals,
      neglectedKingdoms,
      chapterNumber,
      previousContext,
    });

    const { data: inserted, error: insertError } = await supabase
      .from("chapters")
      .insert({
        user_id: userId,
        goal_id: null,
        chapter_number: chapterNumber,
        title: chapter.title,
        narrative: chapter.narrative,
        quests: chapter.quests,
        generated_by: generatedBy,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return {
        status: "error",
        message: `Failed to save chapter: ${insertError?.message ?? "unknown error"}`,
      };
    }

    return { status: "created", chapterId: inserted.id };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error generating chapter",
    };
  }
}
