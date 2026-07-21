"use client";

import { useState, useTransition } from "react";
import { submitReflection } from "./actions";

export function ReflectionForm({ chapterId }: { chapterId: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
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
        await submitReflection(chapterId, text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-ink-border bg-ink-raised/50 p-5"
    >
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-display text-sm uppercase tracking-[0.2em] text-gold">
          What happened in today&apos;s chapter?
        </span>
        <textarea
          className="min-h-28 resize-y rounded border border-ink-border bg-ink px-3 py-3 font-display text-[15px] italic leading-relaxed text-parchment placeholder:text-parchment-faint placeholder:not-italic focus:border-gold"
          placeholder="Write it as it happened..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-crimson-bright">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded border border-gold/60 px-4 py-2 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border disabled:opacity-50"
      >
        {isPending ? "Reflecting..." : "Submit reflection"}
      </button>
    </form>
  );
}
