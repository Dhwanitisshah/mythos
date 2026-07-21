import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ComposeButtons } from "./compose-buttons";

function formatDate(s: string): string {
  return new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function LibraryPage() {
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

  const { data: books } = await supabase
    .from("books")
    .select("id, period_start, period_end, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-wide text-parchment sm:text-3xl">
          The Library
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
            href="/kingdoms"
            className="text-sm text-parchment-dim underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
          >
            Kingdoms
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-ink-border bg-ink-raised/50 p-4">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-parchment-faint">
          Compose a new volume
        </p>
        <ComposeButtons />
      </section>

      {!books || books.length === 0 ? (
        <p className="text-sm italic text-parchment-dim">
          The shelf stands empty. No volume has been written yet — compose one above once
          enough of the record exists.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-border rounded-lg border border-ink-border bg-ink-raised/30">
          {books.map((book) => (
            <li key={book.id}>
              <Link
                href={`/library/${book.id}`}
                className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-ink-raised/60"
              >
                <span className="font-display text-base text-parchment">{book.title}</span>
                <span className="text-xs text-parchment-faint">
                  {formatDate(book.period_start)} – {formatDate(book.period_end)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
