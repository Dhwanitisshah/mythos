import LoginForm from "./login-form";

// Forced dynamic so the per-request CSP nonce (see src/utils/security-headers.ts)
// actually reaches this page's inline scripts — a statically prerendered
// page's HTML is fixed at build time, so it can never carry a fresh
// per-request nonce and would fail CSP script-src checks on every load.
// This must live in a Server Component file — route segment config isn't
// valid in a "use client" file, which is why the form logic moved to
// ./login-form.tsx.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm />;
}
