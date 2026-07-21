"use client";

import { useState, useTransition } from "react";
import type { Quest } from "@/lib/ai";
import { KINGDOMS } from "@/lib/kingdoms";
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

  function handleToggle(index: number) {
    setStatsError("");
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
        {quests.map((quest, index) => (
          <li key={index} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={quest.done}
              disabled={isPending}
              onChange={() => handleToggle(index)}
              className="mt-1"
            />
            <span className={quest.done ? "text-gray-500 line-through" : ""}>
              {quest.kingdom && (
                <span className="mr-1.5 text-xs uppercase tracking-wide text-gray-400">
                  {KINGDOMS[quest.kingdom]}
                </span>
              )}
              {quest.text}
            </span>
          </li>
        ))}
      </ul>
      {statsError && (
        <p className="text-xs text-red-600">Quest saved, but stat update failed: {statsError}</p>
      )}
    </div>
  );
}
