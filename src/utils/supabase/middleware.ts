import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { validatePublicVar } from "@/lib/env";
import { buildCsp, generateNonce, STATIC_SECURITY_HEADERS } from "@/utils/security-headers";

const PROTECTED_PATHS = ["/journey", "/onboarding", "/character", "/kingdoms", "/library"];

function applySecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of STATIC_SECURITY_HEADERS) {
    response.headers.set(name, value);
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // The CSP (with nonce) is also forwarded as a REQUEST header so Next's own
  // renderer sees it and stamps the same nonce onto the inline scripts it
  // generates for App Router streaming — see src/utils/security-headers.ts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    validatePublicVar("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    validatePublicVar(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return applySecurityHeaders(NextResponse.redirect(redirectUrl), csp);
  }

  return applySecurityHeaders(supabaseResponse, csp);
}
