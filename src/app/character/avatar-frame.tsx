import type { Rank } from "@/lib/rank";

// Higher tiers earn a richer frame: more concentric rings, a stronger glow,
// and radial tick marks once you're far enough up the ladder — this is the
// whole point of Phase 13. No motion, just weight: matches the restrained,
// earned tone of the ascension reveal (Phase 12), never arcade/confetti.
export function AvatarFrame({
  svg,
  rank,
  size = 96,
}: {
  svg: string;
  rank: Rank;
  size?: number;
}) {
  const accent = rank.tier.accent;
  const ringCount = 1 + Math.floor(rank.index / 3); // 1..3 across 7 tiers
  const glowPct = Math.round(15 + rank.index * 6); // 15%..51%
  const tickCount = rank.index >= 3 ? Math.min(4 + rank.index * 2, 16) : 0;
  const radius = size / 2;
  const tickInner = radius + 4;
  const tickOuter = radius + (rank.index >= 5 ? 11 : 8);

  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const angle = (i / tickCount) * 2 * Math.PI;
    return {
      x1: radius + Math.cos(angle) * tickInner,
      y1: radius + Math.sin(angle) * tickInner,
      x2: radius + Math.cos(angle) * tickOuter,
      y2: radius + Math.sin(angle) * tickOuter,
    };
  });

  const frameSize = size + 24;
  const ringShadow = Array.from({ length: ringCount }, (_, i) => {
    const width = (i + 1) * 3;
    const color =
      i === ringCount - 1 ? accent : `color-mix(in srgb, ${accent} 40%, var(--color-ink))`;
    return `0 0 0 ${width}px ${color}`;
  }).join(", ");

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{
        width: frameSize,
        height: frameSize,
        filter: `drop-shadow(0 0 ${6 + rank.index * 3}px color-mix(in srgb, ${accent} ${glowPct}%, transparent))`,
      }}
    >
      {tickCount > 0 && (
        <svg
          width={frameSize}
          height={frameSize}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0"
          aria-hidden="true"
        >
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={accent}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          ))}
        </svg>
      )}
      <div
        className="relative flex items-center justify-center rounded-full bg-ink"
        style={{ width: size, height: size, boxShadow: ringShadow }}
      >
        <div
          className="h-full w-full overflow-hidden rounded-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
          // Safe: svg comes from generateAvatarSvg (src/lib/avatar.ts), which
          // builds markup entirely from DiceBear's own part library — the
          // seed only selects among internal parts, never interpolated into
          // the markup itself.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
