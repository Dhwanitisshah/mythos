"use client";

import { useEffect, useState, useTransition } from "react";
import { AVATAR_STYLES, randomSeed, type AvatarStyleKey } from "@/lib/avatar-styles";
import { RANK_TIERS, type Rank } from "@/lib/rank";
import { AvatarFrame } from "../character/avatar-frame";
import { previewAvatar } from "../character/actions";

// Every fresh account lands on the first tier (default stats sum to 60, no
// kingdom activity yet — see rank.ts) so the onboarding preview can safely
// hardcode the Wanderer frame rather than computing a real rank this early.
const WANDERER_RANK: Rank = {
  tier: RANK_TIERS[0],
  index: 0,
  nextTier: RANK_TIERS[1] ?? null,
  progressToNext: 0,
  pointsToNext: RANK_TIERS[1] ? RANK_TIERS[1].minPowerLevel : null,
};

export function AvatarStep({
  style,
  seed,
  onStyleChange,
  onSeedChange,
}: {
  style: AvatarStyleKey;
  seed: string;
  onStyleChange: (style: AvatarStyleKey) => void;
  onSeedChange: (seed: string) => void;
}) {
  const [svg, setSvg] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await previewAvatar(style, seed);
      if (!cancelled && result.ok) setSvg(result.svg);
    });
    return () => {
      cancelled = true;
    };
  }, [style, seed]);

  return (
    <fieldset className="flex flex-col gap-5 border-t border-ink-border pt-6">
      <legend className="mb-1 font-display text-sm uppercase tracking-[0.25em] text-gold">
        Choose your likeness
      </legend>
      <p className="text-xs text-parchment-dim">
        Optional — a fitting default is already chosen. It grows a richer frame as you rise.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <AvatarFrame svg={svg} rank={WANDERER_RANK} />
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {AVATAR_STYLES.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={isPending}
                onClick={() => onStyleChange(s.key)}
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
            onClick={() => onSeedChange(randomSeed())}
            className="w-fit text-xs uppercase tracking-[0.2em] text-parchment-faint underline decoration-ink-border underline-offset-4 transition-colors hover:text-gold-bright disabled:opacity-50"
          >
            Reroll
          </button>
        </div>
      </div>
    </fieldset>
  );
}
