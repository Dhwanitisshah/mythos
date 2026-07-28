"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Identity } from "@/lib/ai";
import { isKingdomKey } from "@/lib/kingdoms";

const MAX_IDENTITY_FIELD_LENGTH = 500;
const MAX_GOAL_TITLE_LENGTH = 200;

export type CompleteOnboardingResult = { ok: false; message: string };

function tooLong(value: string, max: number): boolean {
  return value.length > max;
}

export async function completeOnboarding(
  formData: FormData,
): Promise<CompleteOnboardingResult> {
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
    !goalTitle
  ) {
    return { ok: false, message: "Please answer every question before continuing." };
  }

  if (
    tooLong(identity.dream, MAX_IDENTITY_FIELD_LENGTH) ||
    tooLong(identity.fear, MAX_IDENTITY_FIELD_LENGTH) ||
    tooLong(identity.strength, MAX_IDENTITY_FIELD_LENGTH) ||
    tooLong(identity.value, MAX_IDENTITY_FIELD_LENGTH)
  ) {
    return {
      ok: false,
      message: `Keep each answer under ${MAX_IDENTITY_FIELD_LENGTH} characters.`,
    };
  }

  if (tooLong(goalTitle, MAX_GOAL_TITLE_LENGTH)) {
    return {
      ok: false,
      message: `Keep the goal title under ${MAX_GOAL_TITLE_LENGTH} characters.`,
    };
  }

  if (!isKingdomKey(goalKingdom)) {
    return { ok: false, message: "Please choose a kingdom for your first goal." };
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
    return { ok: false, message: "Could not save your profile. Try again." };
  }

  const { error: goalError } = await supabase.from("goals").insert({
    user_id: user.id,
    title: goalTitle,
    category: goalKingdom,
    kingdom: goalKingdom,
  });

  if (goalError) {
    return { ok: false, message: "Could not save your first goal. Try again." };
  }

  redirect("/journey");
}
