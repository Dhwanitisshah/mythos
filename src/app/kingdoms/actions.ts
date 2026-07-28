"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isKingdomKey } from "@/lib/kingdoms";

const ACTIVE_GOAL_CAP = 4;

const MAX_GOAL_TITLE_LENGTH = 200;

export type AddGoalResult =
  | { ok: true }
  | {
      ok: false;
      reason: "empty-title" | "too-long" | "invalid-kingdom" | "goal-cap" | "duplicate-kingdom" | "failed";
      message: string;
    };

export async function addGoal(kingdom: string, title: string): Promise<AddGoalResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    return { ok: false, reason: "empty-title", message: "Give the goal a title." };
  }
  if (trimmedTitle.length > MAX_GOAL_TITLE_LENGTH) {
    return {
      ok: false,
      reason: "too-long",
      message: `Keep the goal title under ${MAX_GOAL_TITLE_LENGTH} characters.`,
    };
  }

  if (!isKingdomKey(kingdom)) {
    return { ok: false, reason: "invalid-kingdom", message: "That kingdom doesn't exist." };
  }

  const { count, error: countError } = await supabase
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (countError) {
    return { ok: false, reason: "failed", message: "Could not check your active goals. Try again." };
  }

  if ((count ?? 0) >= ACTIVE_GOAL_CAP) {
    return {
      ok: false,
      reason: "goal-cap",
      message: `You can have at most ${ACTIVE_GOAL_CAP} active goals at once.`,
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .eq("kingdom", kingdom)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    return { ok: false, reason: "failed", message: "Could not check this kingdom. Try again." };
  }

  if (existing) {
    return {
      ok: false,
      reason: "duplicate-kingdom",
      message: "This kingdom already has an active goal.",
    };
  }

  const { error: insertError } = await supabase.from("goals").insert({
    user_id: user.id,
    title: trimmedTitle,
    category: kingdom,
    kingdom,
  });

  if (insertError) {
    return { ok: false, reason: "failed", message: "Could not add that goal. Try again." };
  }

  revalidatePath("/kingdoms");
  revalidatePath("/journey");
  return { ok: true };
}

export type SetGoalStatusResult = { ok: true } | { ok: false; message: string };

const GOAL_STATUSES = ["done", "dropped"] as const;

export async function setGoalStatus(
  goalId: string,
  status: "done" | "dropped",
): Promise<SetGoalStatusResult> {
  // The TS param type doesn't survive the network boundary a Server Action
  // is called across — a crafted request could send any string here, so
  // re-check at runtime rather than trusting the compiled-away type.
  if (!(GOAL_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "That isn't a valid goal status." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: updateError } = await supabase
    .from("goals")
    .update({ status })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (updateError) {
    return { ok: false, message: "Could not update that goal. Try again." };
  }

  revalidatePath("/kingdoms");
  revalidatePath("/journey");
  return { ok: true };
}
