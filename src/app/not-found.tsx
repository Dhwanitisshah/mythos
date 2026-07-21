import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rise-in mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-gold">
        Uncharted territory
      </p>
      <h1 className="font-display text-2xl text-parchment">This page isn&apos;t written yet</h1>
      <p className="text-sm text-parchment-dim">
        There&apos;s no chapter at this address. Return to your journey.
      </p>
      <Link
        href="/journey"
        className="rounded border border-gold/60 bg-ink-raised px-6 py-2.5 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border"
      >
        Back to your journey
      </Link>
    </div>
  );
}
