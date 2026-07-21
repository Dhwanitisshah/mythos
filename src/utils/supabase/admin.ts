// SECURITY: this client uses the Supabase SERVICE ROLE key, which BYPASSES
// Row Level Security entirely. It must be imported ONLY by the cron route
// (src/app/api/cron/**) — never by a client component, a user-facing server
// action, or any other request path that runs with a user session. Every
// query made with this client MUST filter by user_id explicitly in
// application code, since RLS is no longer doing that for you.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
