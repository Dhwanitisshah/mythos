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
          className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-gray-700"
        >
          Mark done
        </button>
        <button
          onClick={() => handleClick("dropped")}
          disabled={isPending}
          className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-gray-700"
        >
          Drop
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
