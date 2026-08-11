import { describe, expect, it } from "vitest";
import { computePowerLevel, RANK_TIERS, rankFor, tierIndexByName } from "@/lib/rank";
import type { StatName } from "@/lib/ai";

const BASE_STATS: Record<StatName, number> = {
  discipline: 10,
  strength: 10,
  wisdom: 10,
  calm: 10,
  honor: 10,
  charisma: 10,
};

describe("computePowerLevel", () => {
  it("sums the six stats with no kingdom data", () => {
    expect(computePowerLevel({ stats: BASE_STATS, kingdomStates: [] })).toBe(60);
  });

  it("adds a bounded contribution from average kingdom prosperity", () => {
    // avg prosperity 50 -> round(50 / 5) = 10
    expect(
      computePowerLevel({ stats: BASE_STATS, kingdomStates: [50, 50, 50, 50, 50, 50] }),
    ).toBe(70);
    // avg prosperity 100 -> round(100 / 5) = 20 (max contribution)
    expect(computePowerLevel({ stats: BASE_STATS, kingdomStates: [100, 100] })).toBe(80);
  });

  it("is monotonic with real progress", () => {
    const before = computePowerLevel({ stats: BASE_STATS, kingdomStates: [50] });
    const higherStats = { ...BASE_STATS, strength: 20 };
    const after = computePowerLevel({ stats: higherStats, kingdomStates: [50] });
    expect(after).toBeGreaterThan(before);
  });
});

describe("rankFor", () => {
  it("places a fresh character on the first tier", () => {
    const rank = rankFor(60);
    expect(rank.tier.name).toBe(RANK_TIERS[0].name);
    expect(rank.index).toBe(0);
  });

  it("lands exactly on a tier's floor", () => {
    const knight = RANK_TIERS.find((t) => t.name === "Knight")!;
    const rank = rankFor(knight.minPowerLevel);
    expect(rank.tier.name).toBe("Knight");
  });

  it("stays on the lower tier one point below the next floor", () => {
    const knight = RANK_TIERS.find((t) => t.name === "Knight")!;
    const rank = rankFor(knight.minPowerLevel - 1);
    expect(rank.tier.name).not.toBe("Knight");
  });

  it("computes progressToNext as distance between the current and next floor", () => {
    const wanderer = RANK_TIERS[0];
    const squire = RANK_TIERS[1];
    const midpoint = Math.round((wanderer.minPowerLevel + squire.minPowerLevel) / 2);
    const rank = rankFor(midpoint);
    expect(rank.progressToNext).toBeGreaterThan(0.4);
    expect(rank.progressToNext).toBeLessThan(0.6);
    expect(rank.pointsToNext).toBe(squire.minPowerLevel - midpoint);
  });

  it("reports full progress and no next tier at the top", () => {
    const top = RANK_TIERS[RANK_TIERS.length - 1];
    const rank = rankFor(top.minPowerLevel + 1000);
    expect(rank.tier.name).toBe(top.name);
    expect(rank.nextTier).toBeNull();
    expect(rank.progressToNext).toBe(1);
    expect(rank.pointsToNext).toBeNull();
  });

  it("never returns a negative power level's tier below the floor", () => {
    const rank = rankFor(-50);
    expect(rank.tier.name).toBe(RANK_TIERS[0].name);
    expect(rank.progressToNext).toBeGreaterThanOrEqual(0);
  });
});

describe("tierIndexByName", () => {
  it("returns -1 for null", () => {
    expect(tierIndexByName(null)).toBe(-1);
  });

  it("returns -1 for an unrecognized name", () => {
    expect(tierIndexByName("Not A Tier")).toBe(-1);
  });

  it("returns the matching tier's index", () => {
    expect(tierIndexByName("Wanderer")).toBe(0);
    expect(tierIndexByName(RANK_TIERS[RANK_TIERS.length - 1].name)).toBe(RANK_TIERS.length - 1);
  });
});
