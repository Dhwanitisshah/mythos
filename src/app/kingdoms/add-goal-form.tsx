"use client";

import { useState, useTransition } from "react";
import { addGoal } from "./actions";
import type { KingdomKey } from "@/lib/kingdoms";

export function AddGoalForm({ kingdom, disabled }: { kingdom: KingdomKey; disabled: boolean }) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Give the goal a title.");
      return;
    }

    startTransition(async () => {
      try {
        await addGoal(kingdom, title);
        setTitle("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  if (disabled) {
    return (
      <p className="text-xs text-gray-500">
        You&apos;re at the 4-goal cap — finish or drop a goal to add one here.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-transparent"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What do you want to achieve?"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Adding..." : "Add goal"}
      </button>
    </form>
  );
}
