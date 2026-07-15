"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Log in to Mythos</h1>

      {status === "sent" ? (
        <p className="text-center text-sm text-gray-600">
          Check your inbox at <strong>{email}</strong> for a magic link.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-sm flex-col gap-3"
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {status === "sending" ? "Sending link..." : "Send magic link"}
          </button>
          {status === "error" && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}
        </form>
      )}
    </main>
  );
}
