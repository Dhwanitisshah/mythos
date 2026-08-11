import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { STAT_NAMES, type Quest, type ReflectionExtracted, type StatName } from "@/lib/ai";
import { isKingdomKey, KINGDOMS, KINGDOM_KEYS, type KingdomKey } from "@/lib/kingdoms";
import { computePowerLevel, rankFor } from "@/lib/rank";
import { isSameLocalDay } from "@/lib/timezone";
import { SignOutButton } from "./sign-out-button";
import { BeginChapterButton } from "./begin-chapter-button";
import { QuestChecklist } from "./quest-checklist";
import { ReflectionForm } from "./reflection-form";
import { TimezoneSync } from "./timezone-sync";

// This page's Server Actions (beginTodaysChapter, submitReflection) each make
// a single Gemini call that can exceed the platform default of 10s — same
// rationale as the cron route's maxDuration.
export const maxDuration = 60;

const DEFAULT_STATS: Record<StatName, number> = {
  discipline: 10,
  strength: 10,
  wisdom: 10,
  calm: 10,
  honor: 10,
  charisma: 10,
};

const DEFAULT_PROSPERITY = 50;

export default async function JourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, timezone")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) {
    redirect("/onboarding");
  }

  const { data: activeGoals } = await supabase
    .from("goals")
    .select("id, title, kingdom")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const goals = (activeGoals ?? []).filter(
    (g): g is { id: string; title: string; kingdom: KingdomKey } => isKingdomKey(g.kingdom),
  );

  const { data: statsRow } = await supabase
    .from("stats")
    .select(STAT_NAMES.join(","))
    .eq("user_id", user.id)
    .maybeSingle();
  const stats: Record<StatName, number> = statsRow
    ? (statsRow as unknown as Record<StatName, number>)
    : DEFAULT_STATS;

  const { data: kingdomStateRows } = await supabase
    .from("kingdom_state")
    .select("kingdom, prosperity")
    .eq("user_id", user.id);
  const prosperityByKingdom = new Map<string, number>(
    (kingdomStateRows ?? [])
      .filter((r) => isKingdomKey(r.kingdom))
      .map((r) => [r.kingdom as string, r.prosperity as number]),
  );
  const kingdomStates = KINGDOM_KEYS.map((k) => prosperityByKingdom.get(k) ?? DEFAULT_PROSPERITY);
  const powerLevel = computePowerLevel({ stats, kingdomStates });
  const rank = rankFor(powerLevel);

  const { data: chapters } = await supabase
    .from("chapters")
    .select(
      "id, chapter_number, title, narrative, quests, created_at, reflection, reflection_extracted, reflected_at, generated_by",
    )
    .eq("user_id", user.id)
    .order("chapter_number", { ascending: false })
    .limit(1);

  const latestChapter = chapters?.[0] ?? null;
  const hasTodaysChapter = latestChapter
    ? isSameLocalDay(latestChapter.created_at, profile.timezone)
    : false;
  const reflectionSummary = latestChapter?.reflection_extracted
    ? (latestChapter.reflection_extracted as ReflectionExtracted).summary
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6 sm:p-8">
      {!profile.timezone && <TimezoneSync />}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-parchment sm:text-3xl">
          Your Journey
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/character"
            className="hidden items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-parchment-faint transition-colors hover:text-gold-bright sm:flex"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rank.tier.accent }} />
            {rank.tier.name} · {powerLevel}
          </Link>
          <Link
            href="/kingdoms"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Kingdoms
          </Link>
          <Link
            href="/character"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Character
          </Link>
          <Link
            href="/library"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Library
          </Link>
          <SignOutButton />
        </div>
      </div>

      {goals.length === 0 && !latestChapter ? (
        <p className="text-sm text-parchment-dim">
          You don&apos;t have any active goals yet.{" "}
          <Link href="/kingdoms" className="text-gold-bright underline decoration-ink-border underline-offset-4">
            Set one in Kingdoms
          </Link>{" "}
          to begin your first chapter.
        </p>
      ) : (
        <>
          {goals.length > 0 && (
            <section className="rounded-lg border border-ink-border bg-ink-raised/50 p-4">
              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-parchment-faint">
                Kingdoms in play
              </p>
              <ul className="flex flex-col gap-1">
                {goals.map((g) => (
                  <li key={g.id} className="text-sm text-parchment">
                    <span className="text-parchment-faint">{KINGDOMS[g.kingdom]}:</span>{" "}
                    {g.title}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {goals.length === 0 ? (
            <p className="text-sm text-parchment-dim">
              You don&apos;t have any active goals right now.{" "}
              <Link href="/kingdoms" className="text-gold-bright underline decoration-ink-border underline-offset-4">
                Add one in Kingdoms
              </Link>{" "}
              to begin tomorrow&apos;s chapter.
            </p>
          ) : !hasTodaysChapter ? (
            <BeginChapterButton />
          ) : (
            latestChapter && (
              <article className="rise-in mx-auto flex w-full max-w-[65ch] flex-col gap-6">
                <div className="flex flex-col gap-2 border-b border-ink-border pb-4">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-parchment-faint">
                    Chapter {latestChapter.chapter_number}
                  </p>
                  <h2 className="font-display text-2xl font-semibold leading-snug text-parchment sm:text-3xl">
                    {latestChapter.title}
                  </h2>
                  {latestChapter.generated_by === "auto" && (
                    <p className="text-xs italic text-parchment-faint">
                      Written for you this morning
                    </p>
                  )}
                </div>
                <p className="drop-cap whitespace-pre-wrap text-[15px] leading-[1.9] text-parchment/90">
                  {latestChapter.narrative}
                </p>
                <div className="border-t border-ink-border pt-6">
                  <p className="mb-3 font-display text-sm uppercase tracking-[0.25em] text-gold">
                    Quests
                  </p>
                  <QuestChecklist
                    chapterId={latestChapter.id}
                    quests={latestChapter.quests as Quest[]}
                  />
                </div>

                {!latestChapter.reflected_at ? (
                  <ReflectionForm chapterId={latestChapter.id} />
                ) : (
                  <div className="flex flex-col gap-2 rounded-lg border border-ink-border bg-ink-raised/50 p-5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-parchment-faint">
                      Your reflection
                    </p>
                    <p className="whitespace-pre-wrap font-display text-[15px] italic leading-relaxed text-parchment/90">
                      {latestChapter.reflection}
                    </p>
                    {reflectionSummary && (
                      <p className="text-xs text-parchment-faint">{reflectionSummary}</p>
                    )}
                  </div>
                )}
              </article>
            )
          )}
        </>
      )}
    </main>
  );
}
