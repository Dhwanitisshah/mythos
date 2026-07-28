import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { validatePublicVar } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    validatePublicVar("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    validatePublicVar(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component; ignore since
            // middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}
