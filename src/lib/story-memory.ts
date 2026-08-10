// Bookkeeping for the persistent, bounded story_state row (Phase 10).
// Kept separate from lib/ai.ts (which only knows how to talk to Gemini) and
// generate-daily-chapter.ts (which owns the DB round-trips) — this module is
// pure data shaping, easy to reason about independent of either.

export type Motif = { name: string; note: string; firstChapter: number; lastSeen: number };

const MAX_MOTIFS = 12;
const MAX_RECENT_OPENINGS = 5;

// jsonb comes back from Supabase as `unknown` — never trust it blindly, same
// principle as the AI response parsing in lib/ai.ts. Malformed entries are
// dropped rather than allowed to crash chapter generation.
export function parseMotifs(value: unknown): Motif[] {
  if (!Array.isArray(value)) return [];
  return value.filter((m): m is Motif => {
    if (typeof m !== "object" || m === null) return false;
    const c = m as Record<string, unknown>;
    return (
      typeof c.name === "string" &&
      typeof c.note === "string" &&
      typeof c.firstChapter === "number" &&
      typeof c.lastSeen === "number"
    );
  });
}

// Merges this chapter's newly-extracted motifs into the existing lexicon.
// A name match (case-insensitive) is treated as the world evolving an
// existing motif — its note is updated and lastSeen bumped — rather than a
// duplicate entry. Caps at MAX_MOTIFS, evicting the least-recently-seen
// entries first, so the lexicon fed back into future prompts never grows
// unbounded no matter how many chapters have happened.
export function mergeMotifs(
  existing: Motif[],
  newMotifs: { name: string; note: string }[],
  chapterNumber: number,
): Motif[] {
  const byName = new Map(existing.map((m) => [m.name.toLowerCase(), { ...m }]));

  for (const motif of newMotifs) {
    const key = motif.name.toLowerCase();
    const current = byName.get(key);
    if (current) {
      byName.set(key, { ...current, note: motif.note, lastSeen: chapterNumber });
    } else {
      byName.set(key, {
        name: motif.name,
        note: motif.note,
        firstChapter: chapterNumber,
        lastSeen: chapterNumber,
      });
    }
  }

  const merged = [...byName.values()];
  if (merged.length <= MAX_MOTIFS) return merged;

  return merged.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_MOTIFS);
}

// Keeps only the last MAX_RECENT_OPENINGS opening sentences, oldest first.
export function pushOpening(existing: string[], opening: string): string[] {
  const trimmed = opening.trim();
  if (!trimmed) return existing.slice(-MAX_RECENT_OPENINGS);
  return [...existing, trimmed].slice(-MAX_RECENT_OPENINGS);
}
