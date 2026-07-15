"use client";

import { useTransition } from "react";
import type { Quest } from "@/lib/ai";
import { toggleQuest } from "./actions";

export function QuestChecklist({
  chapterId,
  quests,
}: {
  chapterId: string;
  quests: Quest[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(index: number) {
    startTransition(async () => {
      await toggleQuest(chapterId, index);
    });
  }

  return (
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
            {quest.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
