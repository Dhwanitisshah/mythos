import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Quest } from "@/lib/ai";
import { isKingdomKey, KINGDOM_KEYS, KINGDOMS, KINGDOM_ACCENT, type KingdomKey } from "@/lib/kingdoms";
import { KINGDOM_SIGIL } from "@/components/sigils";
import { AddGoalForm } from "./add-goal-form";
import { GoalStatusButtons } from "./goal-status-buttons";

const ACTIVE_GOAL_CAP = 4;
const STRENGTH_WINDOW_DAYS = 14;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function KingdomsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
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

  const goalByKingdom = new Map(goals.map((g) => [g.kingdom, g]));
  const atCap = goals.length >= ACTIVE_GOAL_CAP;

  const windowStart = daysAgoIso(STRENGTH_WINDOW_DAYS);

  const { data: recentChapters } = await supabase
    .from("chapters")
    .select("quests")
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  const strengthByKingdom = new Map<KingdomKey, number>();
  for (const chapter of recentChapters ?? []) {
    for (const quest of (chapter.quests as Quest[]) ?? []) {
      if (quest.done && quest.kingdom) {
        strengthByKingdom.set(quest.kingdom, (strengthByKingdom.get(quest.kingdom) ?? 0) + 1);
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-parchment sm:text-3xl">
          Kingdoms
        </h1>
        <div className="flex items-center gap-4">
          <Link
            href="/journey"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Journey
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
        </div>
      </div>

      <p className="text-xs text-parchment-faint">
        Up to {ACTIVE_GOAL_CAP} active goals at a time — more than that spreads each day&apos;s
        chapter too thin.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {KINGDOM_KEYS.map((key) => {
          const goal = goalByKingdom.get(key);
          const strength = strengthByKingdom.get(key) ?? 0;
          const Sigil = KINGDOM_SIGIL[key];
          const accent = KINGDOM_ACCENT[key];
          const dormant = !goal;

          return (
            <div
              key={key}
              className={`kingdom-card rounded-lg border p-5 ${
                dormant
                  ? "border-ink-border bg-ink-raised/40"
                  : "border-ink-border bg-ink-raised shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
              }`}
              style={dormant ? undefined : { borderColor: `color-mix(in srgb, ${accent} 45%, var(--color-ink-border))` }}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      color: dormant ? "var(--color-parchment-faint)" : accent,
                      borderColor: dormant ? "var(--color-ink-border)" : `color-mix(in srgb, ${accent} 55%, transparent)`,
                    }}
                  >
                    <Sigil size={22} />
                  </span>
                  <div>
                    <h2
                      className={`font-display text-lg font-semibold ${dormant ? "text-parchment-faint" : "text-parchment"}`}
                    >
                      {KINGDOMS[key]}
                    </h2>
                    <p className="text-[11px] uppercase tracking-wide text-parchment-faint">
                      {dormant ? "Unclaimed lands" : key}
                    </p>
                  </div>
                </div>
              </div>

              {goal ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm leading-relaxed text-parchment">{goal.title}</p>
                  <p className="text-xs text-parchment-dim">
                    {strength} quest{strength === 1 ? "" : "s"} answered in the last{" "}
                    {STRENGTH_WINDOW_DAYS} days
                  </p>
                  <GoalStatusButtons goalId={goal.id} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs italic text-parchment-faint">
                    No banner flies here yet.
                  </p>
                  <AddGoalForm kingdom={key} disabled={atCap} />
                </div>
              )}
            </div>
          );
        })}
      </section>
    </main>
  );
}
