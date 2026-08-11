"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type AcknowledgeTierResult = { ok: true } | { ok: false; message: string };

// Called when the user dismisses the ascension reveal (see ascension-reveal.tsx).
// Persists which tier they've now seen so the reveal doesn't fire again for it.
export async function acknowledgeTier(tierName: string): Promise<AcknowledgeTierResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ last_acknowledged_tier: tierName })
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: "Could not save that. It may show again next visit." };
  }

  revalidatePath("/character");
  return { ok: true };
}
