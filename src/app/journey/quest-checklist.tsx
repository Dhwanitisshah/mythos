"use client";

import { useState, useTransition } from "react";
import type { Quest } from "@/lib/ai";
import { KINGDOMS, KINGDOM_ACCENT } from "@/lib/kingdoms";
import { KINGDOM_SIGIL } from "@/components/sigils";
import { toggleQuest } from "./actions";

export function QuestChecklist({
  chapterId,
  quests,
}: {
  chapterId: string;
  quests: Quest[];
}) {
  const [isPending, startTransition] = useTransition();
  const [statsError, setStatsError] = useState("");
  const [justCompleted, setJustCompleted] = useState<number | null>(null);

  function handleToggle(index: number, done: boolean) {
    setStatsError("");
    if (!done) {
      setJustCompleted(index);
    }
    startTransition(async () => {
      const result = await toggleQuest(chapterId, index);
      if (result.statsError) {
        setStatsError(result.statsError);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {quests.map((quest, index) => {
          const accent = quest.kingdom ? KINGDOM_ACCENT[quest.kingdom] : undefined;
          const Sigil = quest.kingdom ? KINGDOM_SIGIL[quest.kingdom] : null;

          return (
            <li
              key={index}
              className={`flex items-start gap-3 rounded-lg border border-ink-border bg-ink-raised/40 p-3 ${
                justCompleted === index ? "quest-pulse" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={quest.done}
                disabled={isPending}
                onChange={() => handleToggle(index, quest.done)}
                className="mt-1 h-4 w-4 accent-[var(--color-gold)]"
              />
              <span className="flex flex-1 items-start gap-2">
                {Sigil && (
                  <span
                    className="mt-0.5 shrink-0"
                    style={{ color: quest.done ? "var(--color-parchment-faint)" : accent }}
                  >
                    <Sigil size={16} />
                  </span>
                )}
                <span
                  className={
                    quest.done
                      ? "text-sm text-parchment-faint line-through decoration-parchment-faint"
                      : "text-sm text-parchment"
                  }
                >
                  {quest.kingdom && (
                    <span className="mr-1.5 text-[10px] uppercase tracking-wide text-parchment-faint">
                      {KINGDOMS[quest.kingdom]}
                    </span>
                  )}
                  {quest.text}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {statsError && (
        <p className="text-xs text-crimson-bright">Quest saved, but stat update failed: {statsError}</p>
      )}
    </div>
  );
}
