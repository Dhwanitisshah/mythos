import type { SigilProps } from "./types";

// Open book with a key laid across it — Library of Wisdom (learning).
export function WisdomSigil({ className, size = 32 }: SigilProps) {
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
      <path d="M24 14 C20 11 13 10 8 11 L8 34 C13 33 20 34 24 37 C28 34 35 33 40 34 L40 11 C35 10 28 11 24 14 Z" />
      <path d="M24 14 L24 37" />
      <circle cx="33" cy="18" r="3.5" />
      <path d="M35.5 20.5 L41 26 M38 23 L36 25 M40.5 25.5 L38.5 27.5" />
    </svg>
  );
}
