import type { Rank } from "@/lib/rank";

const SIZE = 128;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Pure SVG progress ring — no charting library. Shows progress toward the
// next rank tier; a filled ring at the top tier since there's nowhere left
// to climb.
export function PowerRing({ powerLevel, rank }: { powerLevel: number; rank: Rank }) {
  const offset = CIRCUMFERENCE * (1 - rank.progressToNext);

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-ink-border)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={rank.tier.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-2xl font-semibold text-parchment">{powerLevel}</span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-parchment-faint">Power</span>
      </div>
    </div>
  );
}
