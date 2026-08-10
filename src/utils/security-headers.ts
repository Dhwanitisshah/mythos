// Security headers applied to every response in src/utils/supabase/middleware.ts.
//
// CSP needs a fresh per-request nonce (Next.js App Router's streaming RSC
// payload is delivered via inline <script> tags it injects itself — a CSP
// without either 'unsafe-inline' or a nonce would break every page, so this
// is not optional for an App Router app). The nonce is put on BOTH the
// outgoing request headers (so Next's own renderer sees the CSP and stamps
// the same nonce onto the inline scripts/styles it generates) and the
// response headers (so the browser actually enforces it) — see
// https://nextjs.org/docs/app/guides/content-security-policy.
//
// 'unsafe-inline' is included alongside each nonce as a fallback for
// pre-CSP2 browsers only: any browser that understands nonce-source ignores
// 'unsafe-inline' automatically, so this doesn't weaken the policy for any
// browser actually in use today.

export function generateNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function supabaseOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Allows: this app's own origin for scripts/styles/fonts (next/font
// self-hosts Cinzel/Inter at build time — no fonts.gstatic.com needed);
// the Supabase project origin for connect-src, since the browser Supabase
// client (login page, sign-out) calls Supabase directly over fetch for
// auth. Everything else is denied by default (no inline frames, no
// cross-origin form submits, no plugins).
export function buildCsp(nonce: string): string {
  const supabase = supabaseOrigin();
  const connectSrc = ["'self'", supabase].filter(Boolean).join(" ");

  // Turbopack/React's dev-mode HMR uses eval() for stack-trace
  // reconstruction (a debugging aid only — React explicitly never uses
  // eval() in production). Without 'unsafe-eval' the browser just logs a
  // console warning and skips that feature rather than breaking the page,
  // but there's no reason to keep it that loud locally — scope the
  // allowance to dev only so production stays exactly as strict.
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};`;

  return `
    default-src 'self';
    ${scriptSrc}
    style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
    img-src 'self';
    font-src 'self';
    connect-src ${connectSrc};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const STATIC_SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["X-Frame-Options", "DENY"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  ],
];
