"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { composeBook } from "./actions";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function last7DaysWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function lastMonthWindow(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  start.setDate(start.getDate() + 1);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export function ComposeButtons() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleCompose(window: { startDate: string; endDate: string }) {
    setError("");
    startTransition(async () => {
      try {
        const { book } = await composeBook(window.startDate, window.endDate);
        router.push(`/library/${book.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleCompose(last7DaysWindow())}
          disabled={isPending}
          className="rounded border border-ink-border px-3 py-1.5 text-xs text-parchment-dim transition-colors hover:border-gold/60 hover:text-gold-bright disabled:opacity-50"
        >
          Compose the last 7 days
        </button>
        <button
          onClick={() => handleCompose(lastMonthWindow())}
          disabled={isPending}
          className="rounded border border-ink-border px-3 py-1.5 text-xs text-parchment-dim transition-colors hover:border-gold/60 hover:text-gold-bright disabled:opacity-50"
        >
          Compose last month
        </button>
      </div>
      {error && <p className="text-xs text-crimson-bright">{error}</p>}
    </div>
  );
}
