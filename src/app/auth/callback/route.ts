import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let next = explicitNext ?? "/journey";

      if (!explicitNext && data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded_at")
          .eq("id", data.user.id)
          .maybeSingle();

        next = profile?.onboarded_at ? "/journey" : "/onboarding";
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
