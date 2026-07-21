"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rise-in mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-gold">
        The scribe faltered
      </p>
      <h1 className="font-display text-2xl text-parchment">Something broke the thread of the story</h1>
      <p className="text-sm text-parchment-dim">
        This chapter of your story couldn&apos;t be written. Nothing was lost — try again.
      </p>
      <button
        onClick={reset}
        className="rounded border border-gold/60 bg-ink-raised px-6 py-2.5 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border"
      >
        Try again
      </button>
    </div>
  );
}
