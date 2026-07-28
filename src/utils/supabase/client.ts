import { createBrowserClient } from "@supabase/ssr";
import { validatePublicVar } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    validatePublicVar("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    validatePublicVar(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  );
}
