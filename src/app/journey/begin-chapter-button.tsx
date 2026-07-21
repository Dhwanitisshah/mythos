"use client";

import { useState, useTransition } from "react";
import { beginTodaysChapter } from "./actions";

export function BeginChapterButton() {
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ kind: "info" | "error"; message: string } | null>(null);

  function handleClick() {
    setNotice(null);
    startTransition(async () => {
      const result = await beginTodaysChapter();
      if (!result.ok) {
        setNotice({
          kind: result.reason === "no-active-goals" ? "info" : "error",
          message: result.message,
        });
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
      {notice && (
        <p
          className={
            notice.kind === "info" ? "text-sm text-parchment-dim" : "text-sm text-crimson-bright"
          }
        >
          {notice.message}
        </p>
      )}
    </div>
  );
}
