"use client";

import { useState, useTransition } from "react";
import { beginTodaysChapter } from "./actions";

export function BeginChapterButton({ goalId }: { goalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick() {
    setError("");
    startTransition(async () => {
      try {
        await beginTodaysChapter(goalId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Writing your chapter..." : "Begin today's chapter"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
