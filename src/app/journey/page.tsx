import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Quest, ReflectionExtracted } from "@/lib/ai";
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

  const { data: goal } = await supabase
    .from("goals")
    .select("id, title, category")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: chapters } = goal
    ? await supabase
        .from("chapters")
        .select(
          "id, chapter_number, title, narrative, quests, created_at, reflection, reflection_extracted, reflected_at",
        )
        .eq("goal_id", goal.id)
        .order("chapter_number", { ascending: false })
        .limit(1)
    : { data: null };

  const latestChapter = chapters?.[0] ?? null;
  const hasTodaysChapter = latestChapter
    ? isSameLocalDay(latestChapter.created_at, profile.timezone)
    : false;
  const reflectionSummary = latestChapter?.reflection_extracted
    ? (latestChapter.reflection_extracted as ReflectionExtracted).summary
    : null;
  const statChanges = latestChapter?.reflection_extracted
    ? (latestChapter.reflection_extracted as ReflectionExtracted).statChanges
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8">
      {!profile.timezone && <TimezoneSync />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Journey</h1>
        <div className="flex items-center gap-4">
          <Link href="/character" className="text-sm underline">
            Character
          </Link>
          <SignOutButton />
        </div>
      </div>

      {!goal ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You don&apos;t have an active goal yet.
        </p>
      ) : (
        <>
          <section className="rounded border border-gray-300 p-4 dark:border-gray-700">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {goal.category}
            </p>
            <h2 className="text-lg font-medium">{goal.title}</h2>
          </section>

          {!hasTodaysChapter ? (
            <BeginChapterButton goalId={goal.id} />
          ) : (
            latestChapter && (
              <article className="flex flex-col gap-4">
                <h2 className="text-xl font-semibold">
                  Chapter {latestChapter.chapter_number}: {latestChapter.title}
                </h2>
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
                    {statChanges && statChanges.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {statChanges.map((change, index) => (
                          <li
                            key={index}
                            className="text-xs text-gray-500 dark:text-gray-400"
                          >
                            {capitalize(change.stat)} {change.delta > 0 ? "+" : ""}
                            {change.delta} — {change.reason}
                          </li>
                        ))}
                      </ul>
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
