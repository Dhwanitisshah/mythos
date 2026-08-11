import { RANK_TIERS } from "@/lib/rank";

// The full ladder, current tier marked, tiers above it dimmed as locked —
// makes the next goal visible without hiding how far the top is.
export function TierLadder({ currentIndex }: { currentIndex: number }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {[...RANK_TIERS].reverse().map((tier) => {
        const index = RANK_TIERS.indexOf(tier);
        const isCurrent = index === currentIndex;
        const isLocked = index > currentIndex;

        return (
          <li
            key={tier.name}
            className={`flex items-center gap-3 rounded-md px-3 py-1.5 text-sm ${
              isCurrent ? "bg-ink-raised" : ""
            }`}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                backgroundColor: isLocked ? "var(--color-ink-border)" : tier.accent,
              }}
            />
            <span
              className={`font-display tracking-wide ${
                isCurrent
                  ? "text-parchment"
                  : isLocked
                    ? "text-parchment-faint/60"
                    : "text-parchment-dim"
              }`}
            >
              {tier.name}
            </span>
            {isCurrent && (
              <span className="ml-auto text-[10px] uppercase tracking-[0.2em] text-parchment-faint">
                You are here
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
