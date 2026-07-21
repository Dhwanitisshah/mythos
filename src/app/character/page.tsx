import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { STAT_NAMES, type StatName } from "@/lib/ai";
import { AutoChapterToggle } from "./auto-chapter-toggle";

const DEFAULT_STATS: Record<StatName, number> = {
  discipline: 10,
  strength: 10,
  wisdom: 10,
  calm: 10,
  honor: 10,
  charisma: 10,
};

export default async function CharacterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at, auto_chapter")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarded_at) {
    redirect("/onboarding");
  }

  const { data: statsRow } = await supabase
    .from("stats")
    .select(STAT_NAMES.join(","))
    .eq("user_id", user.id)
    .maybeSingle();

  const stats: Record<StatName, number> = statsRow
    ? (statsRow as unknown as Record<StatName, number>)
    : DEFAULT_STATS;

  const { data: events } = await supabase
    .from("stat_events")
    .select("stat, delta, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Character</h1>
        <div className="flex items-center gap-4">
          <Link href="/journey" className="text-sm underline">
            Journey
          </Link>
          <Link href="/kingdoms" className="text-sm underline">
            Kingdoms
          </Link>
        </div>
      </div>

      <section className="rounded border border-gray-300 p-4 dark:border-gray-700">
        <AutoChapterToggle initialValue={profile.auto_chapter ?? true} />
      </section>

      <section className="flex flex-col gap-4">
        {STAT_NAMES.map((stat) => (
          <div key={stat} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-sm">
              <span className="capitalize">{stat}</span>
              <span className="text-gray-500">{stats[stat]}</span>
            </div>
            <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-800">
              <div
                className="h-2 rounded bg-black dark:bg-white"
                style={{ width: `${Math.min(100, Math.max(0, stats[stat]))}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Recent history</h2>
        {!events || events.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No stat changes yet. They&apos;ll show up here after you reflect on a chapter.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event, index) => (
              <li
                key={index}
                className="flex flex-col gap-0.5 rounded border border-gray-300 p-3 text-sm dark:border-gray-700"
              >
                <span>
                  <span className="capitalize">{event.stat}</span>{" "}
                  {event.delta > 0 ? "+" : ""}
                  {event.delta} — {event.reason}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(event.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
