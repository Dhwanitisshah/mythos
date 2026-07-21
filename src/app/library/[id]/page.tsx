import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { STAT_NAMES, type StatName } from "@/lib/ai";

function formatDate(s: string): string {
  return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: book } = await supabase
    .from("books")
    .select("id, period_start, period_end, title, narrative, stats_snapshot")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!book) {
    notFound();
  }

  const snapshot = book.stats_snapshot as Record<StatName, number>;
  const movements = STAT_NAMES.map((stat) => ({ stat, net: snapshot[stat] ?? 0 })).filter(
    (m) => m.net !== 0,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <Link
          href="/library"
          className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
        >
          ← Library
        </Link>
      </div>

      <article className="rise-in mx-auto flex w-full max-w-[65ch] flex-col gap-6">
        <div className="flex flex-col gap-2 border-b border-ink-border pb-4">
          <p className="text-[11px] uppercase tracking-[0.3em] text-parchment-faint">
            {formatDate(book.period_start)} – {formatDate(book.period_end)}
          </p>
          <h1 className="font-display text-2xl font-semibold leading-snug text-parchment sm:text-3xl">
            {book.title}
          </h1>
        </div>

        <p className="drop-cap whitespace-pre-wrap text-[15px] leading-[1.9] text-parchment/90">
          {book.narrative}
        </p>

        {movements.length > 0 && (
          <div className="border-t border-ink-border pt-6">
            <p className="mb-3 font-display text-sm uppercase tracking-[0.25em] text-gold">
              Movement
            </p>
            <ul className="flex flex-wrap gap-4 text-xs">
              {movements.map((m) => (
                <li key={m.stat}>
                  <span className="font-display capitalize text-parchment-dim">{m.stat}</span>{" "}
                  <span className={m.net > 0 ? "text-gold-bright" : "text-crimson-bright"}>
                    {m.net > 0 ? "+" : ""}
                    {m.net}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </main>
  );
}
