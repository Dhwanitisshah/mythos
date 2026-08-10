import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateChapter,
  updateStoryMemory,
  type GoalInput,
  type Identity,
  type KingdomConditionInput,
  type Momentum,
  type PreviousContext,
  type Quest,
  type ReflectionExtracted,
  type StatTrend,
  type StoryMemory,
} from "@/lib/ai";
import { conditionForProsperity, isKingdomKey, type KingdomKey } from "@/lib/kingdoms";
import { isSameLocalDay } from "@/lib/timezone";
import { mergeMotifs, parseMotifs, pushOpening } from "@/lib/story-memory";

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

    // Momentum: reuses the same 7-day window already queried above for
    // neglect, so this costs one extra query (stat_events), not two.
    let totalQuests = 0;
    let completedQuests = 0;
    for (const chapter of recentChapters ?? []) {
      for (const quest of (chapter.quests as Quest[]) ?? []) {
        totalQuests += 1;
        if (quest.done) completedQuests += 1;
      }
    }
    const recentCompletionRate = totalQuests > 0 ? completedQuests / totalQuests : 0;

    const { data: recentStatEvents, error: statEventsError } = await supabase
      .from("stat_events")
      .select("delta")
      .eq("user_id", userId)
      .gte("created_at", neglectWindowStart);

    if (statEventsError) {
      return { status: "error", message: "Could not determine recent momentum" };
    }

    const netStatDelta = (recentStatEvents ?? []).reduce((sum, e) => sum + e.delta, 0);
    const statTrend: StatTrend = netStatDelta > 0 ? "rising" : netStatDelta < 0 ? "falling" : "steady";

    const momentum: Momentum = {
      chapterNumber,
      recentCompletionRate,
      statTrend,
      activeKingdoms,
    };

    // Kingdom conditions (Phase 11) are enrichment too — a failed load just
    // means this chapter generates without them, same principle as story
    // memory below. Missing rows (a kingdom never yet touched) default to
    // the same prosperity=50 the DB itself defaults a fresh row to — this
    // is the grounded starting state, not an invented one.
    let kingdomConditions: KingdomConditionInput[] = [];
    try {
      const { data: kingdomStateRows, error: kingdomStateError } = await supabase
        .from("kingdom_state")
        .select("kingdom, prosperity")
        .eq("user_id", userId)
        .in("kingdom", activeKingdoms);

      if (kingdomStateError) throw new Error(kingdomStateError.message);

      const prosperityByKingdom = new Map(
        (kingdomStateRows ?? []).map((r) => [r.kingdom as string, r.prosperity as number]),
      );

      kingdomConditions = activeKingdoms.map((kingdom) => {
        const prosperity = prosperityByKingdom.get(kingdom) ?? 50;
        return { kingdom, prosperity, condition: conditionForProsperity(prosperity) };
      });
    } catch (err) {
      console.error(
        `Could not load kingdom state for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Story memory is enrichment, never a blocker (Phase 10) — a failed
    // load just means this chapter generates without it, same as before
    // memory existed at all.
    let storyStateRow: { arc_summary: string; motifs: unknown; recent_openings: string[] } | null =
      null;
    try {
      const { data } = await supabase
        .from("story_state")
        .select("arc_summary, motifs, recent_openings")
        .eq("user_id", userId)
        .maybeSingle();
      storyStateRow = data;
    } catch (err) {
      console.error(
        `Could not load story memory for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const prevMotifs = parseMotifs(storyStateRow?.motifs);
    const storyMemory: StoryMemory = storyStateRow
      ? {
          arcSummary: storyStateRow.arc_summary,
          motifs: prevMotifs.map((m) => ({ name: m.name, note: m.note })),
          recentOpenings: storyStateRow.recent_openings ?? [],
        }
      : null;

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
      storyMemory,
      momentum,
      kingdomConditions,
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

    // Story memory is enrichment, never a blocker: this chapter is already
    // saved above, so any failure here is logged and swallowed rather than
    // turning a successful chapter save into a reported error.
    try {
      const memoryUpdate = await updateStoryMemory({
        prev: {
          arcSummary: storyStateRow?.arc_summary ?? "",
          motifs: prevMotifs.map((m) => ({ name: m.name, note: m.note })),
        },
        chapterTitle: chapter.title,
        chapterNarrative: chapter.narrative,
        // The reflection that informed THIS chapter (if any) — the reflection
        // on this brand-new chapter doesn't exist yet, it's written later.
        reflectionSummary: previousContext?.summary ?? null,
        chapterNumber,
      });

      const mergedMotifs = mergeMotifs(prevMotifs, memoryUpdate.newMotifs, chapterNumber);
      const recentOpenings = pushOpening(
        storyStateRow?.recent_openings ?? [],
        memoryUpdate.openingSentence,
      );

      const { error: storyStateError } = await supabase.from("story_state").upsert(
        {
          user_id: userId,
          arc_summary: memoryUpdate.arcSummary,
          motifs: mergedMotifs,
          recent_openings: recentOpenings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (storyStateError) {
        console.error(
          `Failed to persist story memory for user ${userId}: ${storyStateError.message}`,
        );
      }
    } catch (err) {
      console.error(
        `Story memory update failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { status: "created", chapterId: inserted.id };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error generating chapter",
    };
  }
}
