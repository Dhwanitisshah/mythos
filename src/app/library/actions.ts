"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { generateBookForPeriod, type BookRecord } from "@/lib/generate-book";
import { checkAndClaimThrottle } from "@/lib/rate-limit";

const BOOK_THROTTLE_SECONDS = 60;

export type ComposeBookResult =
  | { ok: true; book: BookRecord }
  | {
      ok: false;
      reason: "invalid-period" | "rate-limited" | "insufficient-record" | "generation-failed";
      message: string;
    };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIOD_DAYS = 366;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export async function composeBook(
  startDate: string,
  endDate: string,
): Promise<ComposeBookResult> {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { ok: false, reason: "invalid-period", message: "That date range isn't valid." };
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (start > end) {
    return { ok: false, reason: "invalid-period", message: "The start date must be before the end date." };
  }

  const spanDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > MAX_PERIOD_DAYS) {
    return {
      ok: false,
      reason: "invalid-period",
      message: `Choose a period of ${MAX_PERIOD_DAYS} days or fewer.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const throttle = await checkAndClaimThrottle(
    supabase,
    user.id,
    "last_book_request_at",
    BOOK_THROTTLE_SECONDS,
  );
  if (throttle.limited) {
    return {
      ok: false,
      reason: "rate-limited",
      message: `You just composed a Book — wait ${throttle.retryAfterSeconds}s and try again.`,
    };
  }

  const result = await generateBookForPeriod(supabase, user.id, startDate, endDate);

  switch (result.status) {
    case "created":
      revalidatePath("/library");
      return { ok: true, book: result.book };
    case "existing":
      return { ok: true, book: result.book };
    case "insufficient":
      return { ok: false, reason: "insufficient-record", message: result.message };
    case "error":
      return { ok: false, reason: "generation-failed", message: result.message };
  }
}
