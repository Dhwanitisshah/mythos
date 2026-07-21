import type { SigilProps } from "./types";

// Compass over a tower — Guild of Builders (career).
export function BuildersSigil({ className, size = 32 }: SigilProps) {
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
      <path d="M16 40 L16 22 L24 8 L32 22 L32 40" />
      <path d="M13 40 L35 40" />
      <path d="M19 40 L19 32 L24 32 L24 40" />
      <path d="M16 26 L32 26" />
      <circle cx="24" cy="14" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
