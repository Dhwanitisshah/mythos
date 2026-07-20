"use client";

import { useState, useTransition } from "react";
import { submitReflection } from "./actions";

export function ReflectionForm({ chapterId }: { chapterId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [statsError, setStatsError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!text.trim()) {
      setError("Write a few words about what happened.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitReflection(chapterId, text);
        if (result.statsError) {
          setStatsError(result.statsError);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded border border-gray-300 p-4 dark:border-gray-700"
    >
      <label className="flex flex-col gap-1 text-sm">
        What happened in today&apos;s chapter?
        <textarea
          className="min-h-24 rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {statsError && (
        <p className="text-xs text-red-600">
          Your reflection was saved, but stat updates failed: {statsError}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Reflecting..." : "Submit reflection"}
      </button>
    </form>
  );
}
