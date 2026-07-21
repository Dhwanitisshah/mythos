// The six life domains a user's goals can belong to. Kept as a fixed, code-level
// lookup rather than a DB table — see the comment at the top of supabase/phase4.sql
// for why.
export const KINGDOM_KEYS = [
  "fitness",
  "learning",
  "relationships",
  "career",
  "money",
  "mind",
] as const;

export type KingdomKey = (typeof KINGDOM_KEYS)[number];

export const KINGDOMS: Record<KingdomKey, string> = {
  fitness: "Kingdom of Iron",
  learning: "Library of Wisdom",
  relationships: "House of Bonds",
  career: "Guild of Builders",
  money: "Treasury",
  mind: "Temple",
};

export const KINGDOM_LIST = KINGDOM_KEYS.map((key) => ({
  key,
  name: KINGDOMS[key],
}));

export function isKingdomKey(value: unknown): value is KingdomKey {
  return typeof value === "string" && (KINGDOM_KEYS as readonly string[]).includes(value);
}
