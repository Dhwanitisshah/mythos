"use client";

import { useState, useTransition } from "react";
import { beginTodaysChapter } from "./actions";

export function BeginChapterButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick() {
    setError("");
    startTransition(async () => {
      try {
        await beginTodaysChapter();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rise-in flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-parchment-dim">The page is blank. What will you write today?</p>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded border border-gold/60 bg-ink-raised px-6 py-2.5 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border disabled:opacity-50"
      >
        {isPending ? "Writing your chapter..." : "Begin today's chapter"}
      </button>
      {error && <p className="text-sm text-crimson-bright">{error}</p>}
    </div>
  );
}
