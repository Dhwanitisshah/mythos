"use client";

import { useState, useTransition } from "react";
import { acknowledgeTier } from "./actions";

export function AscensionReveal({ tierName, accent }: { tierName: string; accent: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    startTransition(async () => {
      await acknowledgeTier(tierName);
    });
  }

  return (
    <div className="ascension-reveal relative overflow-hidden rounded-lg border border-ink-border bg-ink p-8 text-center sm:p-12">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, color-mix(in srgb, ${accent} 18%, transparent) 0%, transparent 70%)`,
        }}
      />
      <div className="relative flex flex-col items-center gap-3">
        <p className="text-[11px] uppercase tracking-[0.35em] text-parchment-faint">You rise</p>
        <h2
          className="ascension-title font-display text-3xl font-semibold tracking-wide sm:text-4xl"
          style={{ color: accent }}
        >
          {tierName}
        </h2>
        <p className="text-sm text-parchment-dim">Your standing in the world has changed.</p>
        <button
          type="button"
          onClick={dismiss}
          disabled={isPending}
          className="mt-4 text-xs uppercase tracking-[0.2em] text-parchment-faint underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
