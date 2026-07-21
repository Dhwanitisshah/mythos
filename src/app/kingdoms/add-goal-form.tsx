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
      <p className="text-xs text-parchment-faint">
        You&apos;re at the 4-goal cap — finish or drop a goal to add one here.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        className="rounded border border-ink-border bg-ink px-3 py-2 text-sm text-parchment placeholder:text-parchment-faint focus:border-gold"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What do you want to achieve?"
      />
      {error && <p className="text-xs text-crimson-bright">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded border border-gold/50 px-3 py-1.5 text-xs text-gold-bright transition-colors hover:border-gold hover:bg-ink-border disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add goal"}
      </button>
    </form>
  );
}
