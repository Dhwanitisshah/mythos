import type { SupabaseClient } from "@supabase/supabase-js";

// Best-effort, single-row-in-Postgres throttle on the expensive AI-calling
// actions (chapter + Book generation). This is NOT a real abuse defense —
// a determined attacker with multiple accounts, or concurrent requests
// racing the check-then-set below (no DB-level lock), can still get through.
// Real abuse defense needs shared, atomic state (e.g. Redis) which we are
// deliberately not adding for a free-tier deploy. All this protects against
// is a single user's own accidental double-clicks/retries burning through
// the Gemini free-tier quota.

export type ThrottleResult =
  | { limited: true; retryAfterSeconds: number }
  | { limited: false };

type ThrottleColumn = "last_chapter_request_at" | "last_book_request_at";

export async function checkAndClaimThrottle(
  supabase: SupabaseClient,
  userId: string,
  column: ThrottleColumn,
  windowSeconds: number,
): Promise<ThrottleResult> {
  const { data: row } = await supabase
    .from("generation_throttle")
    .select(column)
    .eq("user_id", userId)
    .maybeSingle();

  const lastRequestAt = (row as Record<ThrottleColumn, string | null> | null)?.[column];

  if (lastRequestAt) {
    const elapsedMs = Date.now() - new Date(lastRequestAt).getTime();
    const remainingMs = windowSeconds * 1000 - elapsedMs;
    if (remainingMs > 0) {
      return { limited: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
    }
  }

  // Claim the slot before generation starts (not after it finishes) so a
  // second click while the first request is still in flight is also caught.
  await supabase
    .from("generation_throttle")
    .upsert({ user_id: userId, [column]: new Date().toISOString() }, { onConflict: "user_id" });

  return { limited: false };
}
