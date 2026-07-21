import type { SupabaseClient, User } from "@supabase/supabase-js";

export async function resolveNextPath(
  supabase: SupabaseClient,
  user: User,
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.onboarded_at ? "/journey" : "/onboarding";
}
