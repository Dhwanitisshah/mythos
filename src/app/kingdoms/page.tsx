import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Quest } from "@/lib/ai";
import { isKingdomKey, KINGDOM_KEYS, KINGDOMS, type KingdomKey } from "@/lib/kingdoms";
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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kingdoms</h1>
        <div className="flex items-center gap-4">
          <Link href="/journey" className="text-sm underline">
            Journey
          </Link>
          <Link href="/character" className="text-sm underline">
            Character
          </Link>
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Up to {ACTIVE_GOAL_CAP} active goals at a time — more than that spreads each day&apos;s
        chapter too thin.
      </p>

      <section className="flex flex-col gap-4">
        {KINGDOM_KEYS.map((key) => {
          const goal = goalByKingdom.get(key);
          const strength = strengthByKingdom.get(key) ?? 0;

          return (
            <div
              key={key}
              className="rounded border border-gray-300 p-4 dark:border-gray-700"
            >
              <h2 className="text-lg font-medium">{KINGDOMS[key]}</h2>
              <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">{key}</p>

              {goal ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-gray-800 dark:text-gray-200">{goal.title}</p>
                  <p className="text-xs text-gray-500">
                    {strength} quest{strength === 1 ? "" : "s"} answered in the last{" "}
                    {STRENGTH_WINDOW_DAYS} days
                  </p>
                  <GoalStatusButtons goalId={goal.id} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-gray-500">No active goal here yet.</p>
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
