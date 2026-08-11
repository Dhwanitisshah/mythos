import { createAvatar } from "@dicebear/core";
import { identicon, lorelei, micah, notionists, pixelArt } from "@dicebear/collection";
import { sanitizeSeed, type AvatarStyleKey } from "./avatar-styles";

export * from "./avatar-styles";

// Server-only: pulls in every curated style's full part library. Never
// import this from a client component — use ./avatar-styles for metadata
// (labels, validation, seed helpers) instead, so the client bundle doesn't
// carry SVG part data it never needs to generate itself.
const STYLE_MODULES = {
  notionists,
  micah,
  lorelei,
  pixelArt,
  identicon,
} as const satisfies Record<AvatarStyleKey, unknown>;

// Deterministic: the same (style, seed) always renders the same SVG. Runs
// server-side only (called from Server Actions / Server Components) — the
// resulting markup is trusted (built entirely from DiceBear's own internal
// part library, not by interpolating the seed string into markup) and safe
// to inline via dangerouslySetInnerHTML. Never fetched from
// api.dicebear.com: that would need img-src loosened past 'self' in the CSP
// (see security-headers.ts) and add a runtime external dependency for
// something that's fully deterministic from (style, seed) anyway.
export function generateAvatarSvg(style: AvatarStyleKey, seed: string): string {
  const avatar = createAvatar(STYLE_MODULES[style], { seed: sanitizeSeed(seed) || style });
  return avatar.toString();
}
