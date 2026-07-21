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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-parchment sm:text-3xl">
          Character
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/journey"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Journey
          </Link>
          <Link
            href="/kingdoms"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Kingdoms
          </Link>
          <Link
            href="/library"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Library
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-ink-border bg-ink-raised/50 p-4">
        <AutoChapterToggle initialValue={profile.auto_chapter ?? true} />
      </section>

      <section className="flex flex-col gap-5 rounded-lg border border-ink-border bg-ink-raised/50 p-5">
        {STAT_NAMES.map((stat) => (
          <div key={stat} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-display capitalize tracking-wide text-parchment">{stat}</span>
              <span className="text-parchment-dim">{stats[stat]}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-ink">
              <div
                className="stat-bar-fill h-2 rounded-full bg-gradient-to-r from-gold to-gold-bright"
                style={{ width: `${Math.min(100, Math.max(0, stats[stat]))}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-medium tracking-wide text-parchment">
          Chronicle
        </h2>
        {!events || events.length === 0 ? (
          <p className="text-sm text-parchment-dim">
            No stat changes yet. They&apos;ll show up here after you reflect on a chapter.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-border rounded-lg border border-ink-border bg-ink-raised/30">
            {events.map((event, index) => (
              <li key={index} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
                <span>
                  <span className="font-display capitalize text-parchment">{event.stat}</span>{" "}
                  <span className={event.delta > 0 ? "text-gold-bright" : "text-crimson-bright"}>
                    {event.delta > 0 ? "+" : ""}
                    {event.delta}
                  </span>{" "}
                  <span className="text-parchment-dim">— {event.reason}</span>
                </span>
                <span className="text-xs text-parchment-faint">
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
