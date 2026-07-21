import type { SigilProps } from "./types";

// Two interlocked rings — House of Bonds (relationships).
export function BondsSigil({ className, size = 32 }: SigilProps) {
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
      <circle cx="19" cy="24" r="11" />
      <circle cx="29" cy="24" r="11" />
    </svg>
  );
}
