import Link from "next/link";

// Forced dynamic so the per-request CSP nonce (see src/utils/security-headers.ts)
// actually reaches this page's inline scripts — a statically prerendered
// page's HTML is fixed at build time, so it can never carry a fresh
// per-request nonce and would fail CSP script-src checks on every load.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="rise-in flex flex-col items-center gap-4">
        <p className="text-xs uppercase tracking-[0.35em] text-parchment-faint">
          Every day, another page
        </p>
        <h1 className="font-display text-5xl font-semibold tracking-wide text-parchment sm:text-6xl">
          Mythos
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-parchment-dim">
          Your life, written as an epic — one chapter at a time.
        </p>
      </div>
      <Link
        href="/login"
        className="rise-in rounded border border-gold/60 bg-ink-raised px-6 py-2.5 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border"
      >
        Enter
      </Link>
    </main>
  );
}
