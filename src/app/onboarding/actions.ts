"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Identity } from "@/lib/ai";

const CATEGORIES = ["fitness", "learning", "relationships", "career", "mind"] as const;

export async function completeOnboarding(formData: FormData) {
  const identity: Identity = {
    dream: String(formData.get("dream") ?? "").trim(),
    fear: String(formData.get("fear") ?? "").trim(),
    strength: String(formData.get("strength") ?? "").trim(),
    value: String(formData.get("value") ?? "").trim(),
  };
  const goalTitle = String(formData.get("goalTitle") ?? "").trim();
  const goalCategory = String(formData.get("goalCategory") ?? "");

  if (
    !identity.dream ||
    !identity.fear ||
    !identity.strength ||
    !identity.value ||
    !goalTitle ||
    !CATEGORIES.includes(goalCategory as (typeof CATEGORIES)[number])
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
  });

  if (profileError) {
    throw new Error(`Failed to save profile: ${profileError.message}`);
  }

  const { error: goalError } = await supabase.from("goals").insert({
    user_id: user.id,
    title: goalTitle,
    category: goalCategory,
  });

  if (goalError) {
    throw new Error(`Failed to save goal: ${goalError.message}`);
  }

  redirect("/journey");
}
