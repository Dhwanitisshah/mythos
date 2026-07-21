import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveNextPath } from "@/utils/supabase/resolve-next-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next =
        explicitNext ??
        (data.user ? await resolveNextPath(supabase, data.user) : "/journey");

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorDescription =
    searchParams.get("error_description") ?? searchParams.get("error");
  const loginUrl = new URL("/login", origin);
  if (errorDescription) {
    loginUrl.searchParams.set("error", searchParams.get("error") ?? "");
    loginUrl.searchParams.set("error_description", errorDescription);
  }

  return NextResponse.redirect(loginUrl);
}
