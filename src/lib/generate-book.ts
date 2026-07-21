import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateBook,
  STAT_NAMES,
  type BookChapterInput,
  type Identity,
  type Quest,
  type QuestsCompletedByKingdom,
  type ReflectionExtracted,
  type StatDelta,
  type StatName,
} from "@/lib/ai";
import { isKingdomKey, KINGDOMS, type KingdomKey } from "@/lib/kingdoms";

// Below this many chapters in the window, the record is too thin to compose
// a Book from — see the "insufficient" result below.
const MIN_CHAPTERS = 3;

export type BookRecord = {
  id: string;
  period_start: string;
  period_end: string;
  title: string;
  narrative: string;
  stats_snapshot: Record<StatName, number>;
  source_chapter_ids: string[];
  created_at: string;
};

export type GenerateBookResult =
  | { status: "created"; book: BookRecord }
  | { status: "existing"; book: BookRecord }
  | { status: "insufficient"; message: string }
  | { status: "error"; message: string };

function nextDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatPeriodLabel(startDate: string, endDate: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  return `${fmt(startDate)} to ${fmt(endDate)}`;
}

// Core Book-generation logic. Callers own auth: this function trusts the
// userId and supabase client it's given, and always filters by user_id
// explicitly (mirrors generateDailyChapter's contract).
export async function generateBookForPeriod(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<GenerateBookResult> {
  try {
    const { data: existing, error: existingError } = await supabase
      .from("books")
      .select("*")
      .eq("user_id", userId)
      .eq("period_start", startDate)
      .eq("period_end", endDate)
      .maybeSingle();

    if (existingError) {
      return { status: "error", message: "Could not check for an existing Book" };
    }

    if (existing) {
      return { status: "existing", book: existing as BookRecord };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("identity")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return { status: "error", message: "Could not load profile" };
    }

    const exclusiveEnd = nextDayIso(endDate);

    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("id, chapter_number, title, quests, reflection_extracted, created_at")
      .eq("user_id", userId)
      .gte("created_at", startDate)
      .lt("created_at", exclusiveEnd)
      .order("chapter_number", { ascending: true });

    if (chaptersError) {
      return { status: "error", message: "Could not load chapters for this period" };
    }

    const chapterRows = chapters ?? [];

    if (chapterRows.length < MIN_CHAPTERS) {
      return {
        status: "insufficient",
        message:
          "Not enough of the record yet — this period has too few chapters to compose a Book.",
      };
    }

    const { data: statEvents, error: statEventsError } = await supabase
      .from("stat_events")
      .select("stat, delta")
      .eq("user_id", userId)
      .gte("created_at", startDate)
      .lt("created_at", exclusiveEnd);

    if (statEventsError) {
      return { status: "error", message: "Could not load stat history for this period" };
    }

    const netByStat: Record<StatName, number> = {
      discipline: 0,
      strength: 0,
      wisdom: 0,
      calm: 0,
      honor: 0,
      charisma: 0,
    };
    for (const event of statEvents ?? []) {
      if ((STAT_NAMES as readonly string[]).includes(event.stat)) {
        netByStat[event.stat as StatName] += event.delta;
      }
    }

    const { data: activeGoals, error: goalsError } = await supabase
      .from("goals")
      .select("kingdom")
      .eq("user_id", userId)
      .eq("status", "active");

    if (goalsError) {
      return { status: "error", message: "Could not load active kingdoms" };
    }

    const activeKingdoms = [
      ...new Set(
        (activeGoals ?? [])
          .map((g) => g.kingdom)
          .filter((k): k is KingdomKey => isKingdomKey(k)),
      ),
    ];

    const questsByKingdom = new Map<KingdomKey, number>();
    for (const chapter of chapterRows) {
      for (const quest of (chapter.quests as Quest[]) ?? []) {
        if (quest.done && quest.kingdom) {
          questsByKingdom.set(quest.kingdom, (questsByKingdom.get(quest.kingdom) ?? 0) + 1);
        }
      }
    }

    const questsCompleted: QuestsCompletedByKingdom[] = [...questsByKingdom.entries()].map(
      ([kingdom, count]) => ({ kingdom: KINGDOMS[kingdom], count }),
    );

    const bookChapters: BookChapterInput[] = chapterRows.map((c) => {
      const extracted = c.reflection_extracted as ReflectionExtracted | null;
      return {
        number: c.chapter_number,
        title: c.title,
        reflectionSummary: extracted?.summary ?? null,
        mood: extracted?.mood ?? null,
        wins: extracted?.wins ?? [],
        setbacks: extracted?.setbacks ?? [],
      };
    });

    const statDeltas: StatDelta[] = STAT_NAMES.map((stat) => ({ stat, net: netByStat[stat] }));

    const book = await generateBook({
      identity: profile.identity as Identity,
      periodLabel: formatPeriodLabel(startDate, endDate),
      chapters: bookChapters,
      statDeltas,
      questsCompleted,
      kingdoms: activeKingdoms.map((k) => KINGDOMS[k]),
    });

    const { data: inserted, error: insertError } = await supabase
      .from("books")
      .insert({
        user_id: userId,
        period_start: startDate,
        period_end: endDate,
        title: book.title,
        narrative: book.narrative,
        stats_snapshot: netByStat,
        source_chapter_ids: chapterRows.map((c) => c.id),
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      // Unique-constraint race: another request composed this exact period
      // between our existence check and our insert — return that row.
      if (insertError?.code === "23505") {
        const { data: raceExisting } = await supabase
          .from("books")
          .select("*")
          .eq("user_id", userId)
          .eq("period_start", startDate)
          .eq("period_end", endDate)
          .maybeSingle();

        if (raceExisting) {
          return { status: "existing", book: raceExisting as BookRecord };
        }
      }

      return {
        status: "error",
        message: `Failed to save Book: ${insertError?.message ?? "unknown error"}`,
      };
    }

    return { status: "created", book: inserted as BookRecord };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error composing Book",
    };
  }
}
