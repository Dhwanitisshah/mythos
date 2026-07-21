"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { resolveNextPath } from "@/utils/supabase/resolve-next-path";

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  "rounded border border-ink-border bg-ink-raised px-3 py-2 text-parchment placeholder:text-parchment-faint focus:border-gold";

type AuthMode = "magic-link" | "password";
type PasswordMode = "sign-in" | "sign-up";

function paramsToErrorMessage(searchParams: URLSearchParams): string {
  const description = searchParams.get("error_description");
  const error = searchParams.get("error");
  if (!description && !error) return "";
  return (description ?? error ?? "").replace(/\+/g, " ");
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authMode, setAuthMode] = useState<AuthMode>("magic-link");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("sign-in");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | "confirm-email" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState(() =>
    paramsToErrorMessage(searchParams),
  );

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    setStatus("sent");
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    setStatus("sending");

    const supabase = createClient();
    const { data, error } =
      passwordMode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    if (!data.user) {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
      return;
    }

    if (passwordMode === "sign-up" && data.user.identities?.length === 0) {
      setStatus("error");
      setErrorMessage(
        "An account with this email already exists. Try signing in instead.",
      );
      return;
    }

    if (!data.session) {
      // Email confirmation is required: no session yet, so there's nothing
      // to redirect into. The user must click the link Supabase just sent.
      setStatus("confirm-email");
      return;
    }

    const next = await resolveNextPath(supabase, data.user);
    router.push(next);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="rise-in flex flex-col items-center gap-1 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-parchment-faint">
          Mythos
        </p>
        <h1 className="font-display text-3xl font-semibold text-parchment">
          Return to your story
        </h1>
      </div>

      <div className="rise-in flex w-full max-w-sm flex-col gap-4">
        {errorMessage && (
          <p className="rounded border border-crimson/60 bg-crimson/10 px-3 py-2 text-sm text-crimson-bright">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => {
              setAuthMode("password");
              setStatus("idle");
              setErrorMessage("");
            }}
            className={
              authMode === "password"
                ? "font-display text-gold-bright"
                : "text-parchment-faint transition-colors hover:text-parchment-dim"
            }
          >
            Password
          </button>
          <span className="text-ink-border">|</span>
          <button
            type="button"
            onClick={() => {
              setAuthMode("magic-link");
              setStatus("idle");
              setErrorMessage("");
            }}
            className={
              authMode === "magic-link"
                ? "font-display text-gold-bright"
                : "text-parchment-faint transition-colors hover:text-parchment-dim"
            }
          >
            Magic link
          </button>
        </div>

        {authMode === "magic-link" ? (
          status === "sent" ? (
            <p className="text-center text-sm text-parchment-dim">
              Check your inbox at <strong className="text-parchment">{email}</strong> for a
              magic link.
            </p>
          ) : (
            <form
              onSubmit={handleMagicLinkSubmit}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="rounded border border-gold/60 bg-ink-raised px-3 py-2 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border disabled:opacity-50"
              >
                {status === "sending" ? "Sending link..." : "Send magic link"}
              </button>
            </form>
          )
        ) : status === "confirm-email" ? (
          <p className="text-center text-sm text-parchment-dim">
            Check your inbox at <strong className="text-parchment">{email}</strong> to confirm
            your account before signing in.
          </p>
        ) : (
          <form
            onSubmit={handlePasswordSubmit}
            className="flex flex-col gap-3"
          >
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder="Password"
              autoComplete={
                passwordMode === "sign-in" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded border border-gold/60 bg-ink-raised px-3 py-2 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border disabled:opacity-50"
            >
              {status === "sending"
                ? "Please wait..."
                : passwordMode === "sign-in"
                  ? "Sign in"
                  : "Create account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPasswordMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"));
                setErrorMessage("");
              }}
              className="text-center text-sm text-parchment-faint underline decoration-ink-border underline-offset-4 transition-colors hover:text-parchment-dim"
            >
              {passwordMode === "sign-in"
                ? "Need an account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
