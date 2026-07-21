import type { SigilProps } from "./types";

// Crossed hammers over an anvil — Kingdom of Iron (fitness).
export function IronSigil({ className, size = 32 }: SigilProps) {
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
      <path d="M10 12 L22 24 M10 12 L6 8 M22 24 L18 28" />
      <path d="M38 12 L26 24 M38 12 L42 8 M26 24 L30 28" />
      <rect x="6" y="6" width="8" height="5" rx="1" transform="rotate(-45 10 8.5)" />
      <rect x="34" y="6" width="8" height="5" rx="1" transform="rotate(45 38 8.5)" />
      <path d="M14 36 L34 36 L31 42 L17 42 Z" />
      <path d="M18 32 L30 32 L34 36 L14 36 Z" />
    </svg>
  );
}
