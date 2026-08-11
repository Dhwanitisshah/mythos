"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { generateAvatarSvg, isAvatarStyleKey, sanitizeSeed } from "@/lib/avatar";

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

export type PreviewAvatarResult =
  | { ok: true; svg: string }
  | { ok: false; message: string };

// Read-only: renders an avatar SVG for a candidate (style, seed) without
// persisting anything. Used by the picker (both onboarding and /character)
// to show a live preview as the user browses styles / rerolls before it's
// saved. Still fully server-side, still no network call.
export async function previewAvatar(style: string, seed: string): Promise<PreviewAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAvatarStyleKey(style)) {
    return { ok: false, message: "That isn't a recognized avatar style." };
  }

  return { ok: true, svg: generateAvatarSvg(style, sanitizeSeed(seed)) };
}

export type SetAvatarResult =
  | { ok: true; svg: string }
  | { ok: false; reason: "invalid-style" | "update-failed"; message: string };

export async function setAvatar(style: string, seed: string): Promise<SetAvatarResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isAvatarStyleKey(style)) {
    return { ok: false, reason: "invalid-style", message: "That isn't a recognized avatar style." };
  }

  const seedToSave = sanitizeSeed(seed) || user.id;

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_style: style, avatar_seed: seedToSave })
    .eq("id", user.id);

  if (error) {
    return { ok: false, reason: "update-failed", message: "Could not save your avatar. Try again." };
  }

  revalidatePath("/character");
  revalidatePath("/journey");

  return { ok: true, svg: generateAvatarSvg(style, seedToSave) };
}
