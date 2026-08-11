// Phase 13: avatar style metadata + helpers that are safe to import from
// client components (the picker UI). Deliberately has NO dependency on
// @dicebear/core or @dicebear/collection — those pull in each style's full
// part library, which is only needed server-side (see generateAvatarSvg in
// ./avatar.ts) and would otherwise bloat the client bundle for no reason,
// since the client never generates SVGs itself.
//
// Most of DiceBear's catalogue (avataaars, bottts, fun-emoji, big-smile,
// croodles, ...) reads as cute/cartoon avatars that fight this app's dark
// fantasy tone. This is a deliberately small, curated subset — the most
// illustrative/portrait styles plus one explicitly retro-RPG option — and
// even these are never shown bare: always wrapped in the rank frame
// (src/app/character/avatar-frame.tsx), which is what makes them fit.
export type AvatarStyleKey = "notionists" | "micah" | "lorelei" | "pixelArt" | "identicon";

export const AVATAR_STYLES: { key: AvatarStyleKey; label: string; note: string }[] = [
  {
    key: "notionists",
    label: "Ink Sketch",
    note: "Hand-drawn portrait linework — a woodcut character study, not a cartoon.",
  },
  {
    key: "micah",
    label: "Illustrated",
    note: "Flat, strongly-shaded portraiture — closer to a storybook plate than an app avatar.",
  },
  {
    key: "lorelei",
    label: "Storybook",
    note: "Soft illustrated portrait in the same register as the chapter narration.",
  },
  {
    key: "pixelArt",
    label: "Pixel Relic",
    note: "A retro-RPG sprite — an old-world relic among the illustrated portraits.",
  },
  {
    key: "identicon",
    label: "Sigil",
    note: "An abstract geometric mark, no face at all — a heraldic sigil for those who'd rather not be depicted.",
  },
];

const AVATAR_STYLE_KEYS = new Set<string>(AVATAR_STYLES.map((s) => s.key));

export const DEFAULT_AVATAR_STYLE: AvatarStyleKey = "notionists";

export function isAvatarStyleKey(value: unknown): value is AvatarStyleKey {
  return typeof value === "string" && AVATAR_STYLE_KEYS.has(value);
}

const MAX_SEED_LENGTH = 64;

export function sanitizeSeed(seed: string): string {
  return seed.trim().slice(0, MAX_SEED_LENGTH);
}

// Cosmetic randomness only (which portrait variant to show) — no security
// property needed, so Math.random is fine and this can run client-side too.
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 12);
}
