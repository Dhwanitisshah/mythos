import { STAT_NAMES, type StatName } from "./ai";

// Phase 12: Power Level and Rank are DERIVED entirely from the real record —
// the six stats plus average kingdom prosperity — never stored, never
// invented. Same pattern as conditionForProsperity in src/lib/kingdoms.ts:
// one place owns the thresholds, nothing elsewhere gets to award points.

export type RankTier = {
  name: string;
  minPowerLevel: number;
  // CSS var reference from the existing accent system (globals.css).
  accent: string;
};

// Ordered ascending by minPowerLevel. A fresh character (all six stats at
// their default of 10, no kingdom activity yet — prosperity defaults to 50
// per kingdom, see kingdoms/page.tsx) sits at power level 70, comfortably
// inside the first tier.
export const RANK_TIERS: RankTier[] = [
  { name: "Wanderer", minPowerLevel: 0, accent: "var(--color-parchment-faint)" },
  { name: "Squire", minPowerLevel: 110, accent: "var(--color-kingdom-fitness)" },
  { name: "Knight", minPowerLevel: 180, accent: "var(--color-kingdom-career)" },
  { name: "Warden", minPowerLevel: 260, accent: "var(--color-kingdom-mind)" },
  { name: "Champion", minPowerLevel: 350, accent: "var(--color-crimson-bright)" },
  { name: "Ascendant", minPowerLevel: 440, accent: "var(--color-gold)" },
  { name: "Sovereign", minPowerLevel: 520, accent: "var(--color-gold-bright)" },
];

export type PowerLevelInput = {
  stats: Record<StatName, number>;
  // One prosperity value (0-100) per kingdom currently tracked. Callers pass
  // a fixed six-entry array (missing rows default to 50, same fallback used
  // on /kingdoms) so power level is always well-defined.
  kingdomStates: number[];
};

// Power Level = sum of the six stats (0-600) + a bounded contribution from
// average kingdom prosperity (0-100 -> 0-20 via /5, rounded). Monotonic with
// real progress: it only rises when a stat or a kingdom's prosperity rises,
// and only falls when those fall (reopening a quest, sustained neglect).
export function computePowerLevel({ stats, kingdomStates }: PowerLevelInput): number {
  const statSum = STAT_NAMES.reduce((sum, name) => sum + stats[name], 0);
  const avgProsperity =
    kingdomStates.length > 0
      ? kingdomStates.reduce((sum, p) => sum + p, 0) / kingdomStates.length
      : 0;
  return statSum + Math.round(avgProsperity / 5);
}

export type Rank = {
  tier: RankTier;
  index: number;
  nextTier: RankTier | null;
  // 0..1, distance from the current tier's floor to the next tier's floor.
  // Top tier reports 1 (no further ground to cover).
  progressToNext: number;
  // null at the top tier.
  pointsToNext: number | null;
};

export function rankFor(powerLevel: number): Rank {
  let index = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (powerLevel >= RANK_TIERS[i].minPowerLevel) {
      index = i;
      break;
    }
  }

  const tier = RANK_TIERS[index];
  const nextTier = RANK_TIERS[index + 1] ?? null;

  if (!nextTier) {
    return { tier, index, nextTier: null, progressToNext: 1, pointsToNext: null };
  }

  const span = nextTier.minPowerLevel - tier.minPowerLevel;
  const progressToNext = Math.min(1, Math.max(0, (powerLevel - tier.minPowerLevel) / span));
  const pointsToNext = Math.max(0, nextTier.minPowerLevel - powerLevel);

  return { tier, index, nextTier, progressToNext, pointsToNext };
}

// Maps a tier name (as stored in profiles.last_acknowledged_tier) back to its
// ladder index, so an ascension can be detected by comparing indices. -1 for
// null/unrecognized — callers treat that as "no tier acknowledged yet".
export function tierIndexByName(name: string | null): number {
  if (!name) return -1;
  return RANK_TIERS.findIndex((t) => t.name === name);
}
