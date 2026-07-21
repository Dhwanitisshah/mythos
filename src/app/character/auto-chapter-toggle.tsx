"use client";

import { useState, useTransition } from "react";
import { setAutoChapter } from "@/app/journey/actions";

export function AutoChapterToggle({ initialValue }: { initialValue: boolean }) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setError("");
    startTransition(async () => {
      try {
        await setAutoChapter(next);
      } catch (err) {
        setEnabled(!next);
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center justify-between gap-4 text-sm">
        <span>
          Auto-write my chapters
          <span className="block text-xs text-gray-500">
            Each morning, write today&apos;s chapter for me if I haven&apos;t yet.
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={isPending}
          onChange={handleToggle}
          className="h-4 w-4"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
