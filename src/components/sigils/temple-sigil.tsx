import type { SigilProps } from "./types";

// Crescent moon cradling a lotus — Temple (mind).
export function TempleSigil({ className, size = 32 }: SigilProps) {
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
      <path d="M30 10 A13 13 0 1 0 30 38 A16 16 0 0 1 30 10 Z" />
      <path d="M24 34 C21 31 21 27 24 24 C27 27 27 31 24 34 Z" />
      <path d="M17 31 C15 29 15 26 17 24 C19 26 19 29 17 31 Z" />
      <path d="M24 34 L24 40" />
    </svg>
  );
}
