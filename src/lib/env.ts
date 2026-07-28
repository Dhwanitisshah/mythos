// Central env-var contract for the app.
//
// This module validates that every required var is present and non-empty
// the first time it's imported, and throws ONE clear error naming exactly
// which var is missing — instead of letting a misconfigured deploy fail
// later with a cryptic crash deep inside middleware or an AI call.
//
// IMPORTANT — Next.js inlining constraint:
// NEXT_PUBLIC_* vars are replaced at build time by Next.js's bundler, and
// that only happens when the bundler sees a literal `process.env.NEXT_PUBLIC_X`
// expression at the call site (e.g. inside src/utils/supabase/client.ts). A
// dynamic lookup like `process.env[key]` is NOT statically analyzable, so it
// would resolve to `undefined` in the browser bundle. For that reason this
// file does NOT read `process.env.NEXT_PUBLIC_*` itself — each call site
// keeps its own literal read, and (server-side only) calls
// `validatePublicVar` with the value it already read, so misconfiguration is
// still caught with a named error rather than a silent `undefined!`.
//
// Server-only vars (never read in client code) ARE centralized here, since
// they have no inlining constraint and this file is only ever imported from
// server-side code (server actions, route handlers, admin client).

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

/**
 * Validates a NEXT_PUBLIC_* value that was already read via a literal
 * `process.env.NEXT_PUBLIC_X` at the call site (required for Next.js to
 * inline it into the client bundle). Safe to call from both server and
 * client code — it only inspects the value passed in, never reads env itself.
 */
export function validatePublicVar(name: string, value: string | undefined): string {
  return required(name, value);
}

// Server-only secrets — importing this file from client code is a mistake;
// keep these reads out of any file bundled for the browser.
export const serverEnv = {
  get SUPABASE_SERVICE_ROLE_KEY() {
    return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get GEMINI_API_KEY() {
    return required("GEMINI_API_KEY", process.env.GEMINI_API_KEY);
  },
  get CRON_SECRET() {
    return required("CRON_SECRET", process.env.CRON_SECRET);
  },
} as const;
