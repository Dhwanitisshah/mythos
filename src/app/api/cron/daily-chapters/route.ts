import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { generateDailyChapter } from "@/lib/generate-daily-chapter";
import { getLocalDateString, getLocalHour } from "@/lib/timezone";
import { applyNightlyDecay } from "@/lib/kingdom-state";
import { isKingdomKey, type KingdomKey } from "@/lib/kingdoms";

// Several sequential Gemini calls (one per due user) can comfortably exceed
// the platform default of 10s.
export const maxDuration = 60;

const MORNING_WINDOW_START_HOUR = 4;
const MORNING_WINDOW_END_HOUR = 9; // exclusive

type UserDetail = {
  userId: string;
  result: string;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: candidates, error: candidatesError } = await supabase
    .from("profiles")
    .select("id, timezone")
    .eq("auto_chapter", true)
    .not("timezone", "is", null);

  if (candidatesError) {
    return NextResponse.json(
      { error: `Could not load candidate users: ${candidatesError.message}` },
      { status: 500 },
    );
  }

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  let decayed = 0;
  const details: UserDetail[] = [];

  // Sequential on purpose: the Gemini free tier is rate-limited (15 req/min),
  // and one user's failure must never abort the rest.
  for (const profile of candidates ?? []) {
    const timezone = profile.timezone as string | null;
    if (!timezone) continue;

    let localHour: number;
    try {
      localHour = getLocalHour(timezone);
    } catch {
      // Invalid/unrecognized IANA timezone string — skip rather than crash.
      failed += 1;
      details.push({ userId: profile.id, result: `error: invalid timezone "${timezone}"` });
      continue;
    }

    // Kingdom prosperity decay (Phase 11) is a once-per-local-day
    // bookkeeping tick, independent of the morning window below — that
    // window only governs chapter *writing* time. Decay is idempotent via
    // last_decayed_on, so evaluating it on every invocation is safe even
    // though this route only fires once daily. Best-effort: a failure here
    // must never block this user's chapter generation below.
    try {
      const localToday = getLocalDateString(timezone);
      const { data: activeGoals, error: goalsError } = await supabase
        .from("goals")
        .select("kingdom")
        .eq("user_id", profile.id)
        .eq("status", "active");

      if (goalsError) {
        throw new Error(goalsError.message);
      }

      const activeKingdoms = [
        ...new Set((activeGoals ?? []).map((g) => g.kingdom).filter(isKingdomKey)),
      ] as KingdomKey[];

      for (const kingdom of activeKingdoms) {
        const result = await applyNightlyDecay(supabase, profile.id, kingdom, localToday);
        if (result === "decayed") decayed += 1;
      }
    } catch (err) {
      console.error(
        `Kingdom decay failed for user ${profile.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (localHour < MORNING_WINDOW_START_HOUR || localHour >= MORNING_WINDOW_END_HOUR) {
      continue;
    }

    processed += 1;

    try {
      const result = await generateDailyChapter(supabase, profile.id, "auto");
      switch (result.status) {
        case "created":
          created += 1;
          details.push({ userId: profile.id, result: "created" });
          break;
        case "skipped-already-exists":
        case "skipped-no-goals":
          skipped += 1;
          details.push({ userId: profile.id, result: result.status });
          break;
        case "error":
          failed += 1;
          details.push({ userId: profile.id, result: `error: ${result.message}` });
          break;
      }
    } catch (err) {
      failed += 1;
      details.push({
        userId: profile.id,
        result: `error: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    }
  }

  return NextResponse.json({ processed, created, skipped, failed, decayed, details });
}
