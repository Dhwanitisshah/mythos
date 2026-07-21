import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Quest, ReflectionExtracted } from "@/lib/ai";
import { isKingdomKey, KINGDOMS, type KingdomKey } from "@/lib/kingdoms";
import { isSameLocalDay } from "@/lib/timezone";
import { SignOutButton } from "./sign-out-button";
import { BeginChapterButton } from "./begin-chapter-button";
import { QuestChecklist } from "./quest-checklist";
import { ReflectionForm } from "./reflection-form";
import { TimezoneSync } from "./timezone-sync";

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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8">
      {!profile.timezone && <TimezoneSync />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Journey</h1>
        <div className="flex items-center gap-4">
          <Link href="/kingdoms" className="text-sm underline">
            Kingdoms
          </Link>
          <Link href="/character" className="text-sm underline">
            Character
          </Link>
          <SignOutButton />
        </div>
      </div>

      {goals.length === 0 && !latestChapter ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You don&apos;t have any active goals yet.{" "}
          <Link href="/kingdoms" className="underline">
            Set one in Kingdoms
          </Link>{" "}
          to begin your first chapter.
        </p>
      ) : (
        <>
          {goals.length > 0 && (
            <section className="rounded border border-gray-300 p-4 dark:border-gray-700">
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
                Kingdoms in play
              </p>
              <ul className="flex flex-col gap-1">
                {goals.map((g) => (
                  <li key={g.id} className="text-sm">
                    <span className="text-gray-500">{KINGDOMS[g.kingdom]}:</span>{" "}
                    {g.title}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {goals.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You don&apos;t have any active goals right now.{" "}
              <Link href="/kingdoms" className="underline">
                Add one in Kingdoms
              </Link>{" "}
              to begin tomorrow&apos;s chapter.
            </p>
          ) : !hasTodaysChapter ? (
            <BeginChapterButton />
          ) : (
            latestChapter && (
              <article className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold">
                    Chapter {latestChapter.chapter_number}: {latestChapter.title}
                  </h2>
                  {latestChapter.generated_by === "auto" && (
                    <p className="text-xs text-gray-500">Written for you this morning</p>
                  )}
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">
                  {latestChapter.narrative}
                </p>
                <QuestChecklist
                  chapterId={latestChapter.id}
                  quests={latestChapter.quests as Quest[]}
                />

                {!latestChapter.reflected_at ? (
                  <ReflectionForm chapterId={latestChapter.id} />
                ) : (
                  <div className="flex flex-col gap-1 rounded border border-gray-300 p-4 dark:border-gray-700">
                    <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                      {latestChapter.reflection}
                    </p>
                    {reflectionSummary && (
                      <p className="text-xs italic text-gray-500">{reflectionSummary}</p>
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
