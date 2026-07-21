"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isKingdomKey } from "@/lib/kingdoms";

const ACTIVE_GOAL_CAP = 4;

export async function addGoal(kingdom: string, title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Goal title cannot be empty");
  }

  if (!isKingdomKey(kingdom)) {
    throw new Error("Invalid kingdom");
  }

  const { count, error: countError } = await supabase
    .from("goals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (countError) {
    throw new Error("Could not check your active goals");
  }

  if ((count ?? 0) >= ACTIVE_GOAL_CAP) {
    throw new Error(`You can have at most ${ACTIVE_GOAL_CAP} active goals at once.`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", user.id)
    .eq("kingdom", kingdom)
    .eq("status", "active")
    .maybeSingle();

  if (existingError) {
    throw new Error("Could not check this kingdom");
  }

  if (existing) {
    throw new Error("This kingdom already has an active goal");
  }

  const { error: insertError } = await supabase.from("goals").insert({
    user_id: user.id,
    title: trimmedTitle,
    category: kingdom,
    kingdom,
  });

  if (insertError) {
    throw new Error(`Failed to add goal: ${insertError.message}`);
  }

  revalidatePath("/kingdoms");
  revalidatePath("/journey");
}

export async function setGoalStatus(goalId: string, status: "done" | "dropped") {
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
    throw new Error(`Failed to update goal: ${updateError.message}`);
  }

  revalidatePath("/kingdoms");
  revalidatePath("/journey");
}
