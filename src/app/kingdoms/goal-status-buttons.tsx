"use client";

import { useState, useTransition } from "react";
import { setGoalStatus } from "./actions";

export function GoalStatusButtons({ goalId }: { goalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick(status: "done" | "dropped") {
    setError("");
    startTransition(async () => {
      try {
        await setGoalStatus(goalId, status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <button
          onClick={() => handleClick("done")}
          disabled={isPending}
          className="rounded border border-ink-border px-3 py-1 text-xs text-parchment-dim transition-colors hover:border-gold/60 hover:text-gold-bright disabled:opacity-50"
        >
          Mark done
        </button>
        <button
          onClick={() => handleClick("dropped")}
          disabled={isPending}
          className="rounded border border-ink-border px-3 py-1 text-xs text-parchment-dim transition-colors hover:border-crimson/60 hover:text-crimson-bright disabled:opacity-50"
        >
          Drop
        </button>
      </div>
      {error && <p className="text-xs text-crimson-bright">{error}</p>}
    </div>
  );
}
