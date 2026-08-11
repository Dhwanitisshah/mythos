"use client";

import { useState, useTransition } from "react";
import { AVATAR_STYLES, randomSeed, type AvatarStyleKey } from "@/lib/avatar-styles";
import type { Rank } from "@/lib/rank";
import { AvatarFrame } from "./avatar-frame";
import { setAvatar } from "./actions";

export function AvatarPicker({
  initialStyle,
  initialSeed,
  initialSvg,
  rank,
}: {
  initialStyle: AvatarStyleKey;
  initialSeed: string;
  initialSvg: string;
  rank: Rank;
}) {
  const [style, setStyle] = useState(initialStyle);
  const [seed, setSeed] = useState(initialSeed);
  const [svg, setSvg] = useState(initialSvg);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function apply(nextStyle: AvatarStyleKey, nextSeed: string) {
    setError("");
    startTransition(async () => {
      const result = await setAvatar(nextStyle, nextSeed);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStyle(nextStyle);
      setSeed(nextSeed);
      setSvg(result.svg);
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <AvatarFrame svg={svg} rank={rank} />
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-parchment-faint">Likeness</p>
        <div className="flex flex-wrap gap-2">
          {AVATAR_STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={isPending}
              onClick={() => apply(s.key, seed)}
              title={s.note}
              className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide transition-colors disabled:opacity-50 ${
                style === s.key
                  ? "border-gold text-gold-bright"
                  : "border-ink-border text-parchment-dim hover:border-gold/60 hover:text-parchment"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => apply(style, randomSeed())}
          className="w-fit text-xs uppercase tracking-[0.2em] text-parchment-faint underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright disabled:opacity-50"
        >
          Reroll
        </button>
        {error && <p className="text-xs text-crimson-bright">{error}</p>}
      </div>
    </div>
  );
}
