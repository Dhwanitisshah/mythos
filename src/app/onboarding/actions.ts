"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Identity } from "@/lib/ai";
import { isKingdomKey } from "@/lib/kingdoms";

export async function completeOnboarding(formData: FormData) {
  const identity: Identity = {
    dream: String(formData.get("dream") ?? "").trim(),
    fear: String(formData.get("fear") ?? "").trim(),
    strength: String(formData.get("strength") ?? "").trim(),
    value: String(formData.get("value") ?? "").trim(),
  };
  const goalTitle = String(formData.get("goalTitle") ?? "").trim();
  const goalKingdom = String(formData.get("goalKingdom") ?? "");
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (
    !identity.dream ||
    !identity.fear ||
    !identity.strength ||
    !identity.value ||
    !goalTitle ||
    !isKingdomKey(goalKingdom)
  ) {
    throw new Error("All fields are required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    identity,
    onboarded_at: new Date().toISOString(),
    timezone: timezone || null,
  });

  if (profileError) {
    throw new Error(`Failed to save profile: ${profileError.message}`);
  }

  const { error: goalError } = await supabase.from("goals").insert({
    user_id: user.id,
    title: goalTitle,
    category: goalKingdom,
    kingdom: goalKingdom,
  });

  if (goalError) {
    throw new Error(`Failed to save goal: ${goalError.message}`);
  }

  redirect("/journey");
}
