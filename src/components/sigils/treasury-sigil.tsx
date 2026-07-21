import type { SigilProps } from "./types";

// Coin balanced on a set of scales — Treasury (money).
export function TreasurySigil({ className, size = 32 }: SigilProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M24 8 L24 18" />
      <path d="M10 14 L38 14" />
      <path d="M10 14 L5 24 A5 5 0 0 0 15 24 Z" />
      <path d="M38 14 L33 24 A5 5 0 0 0 43 24 Z" />
      <circle cx="24" cy="30" r="6" />
      <path d="M18 40 L30 40" />
      <path d="M24 36 L24 40" />
    </svg>
  );
}
