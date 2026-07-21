"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "./actions";
import { KINGDOM_LIST } from "@/lib/kingdoms";

const inputClass =
  "rounded border border-ink-border bg-ink-raised px-3 py-2 text-parchment placeholder:text-parchment-faint focus:border-gold";

export function OnboardingForm() {
  const [dream, setDream] = useState("");
  const [fear, setFear] = useState("");
  const [strength, setStrength] = useState("");
  const [value, setValue] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalKingdom, setGoalKingdom] = useState<string>(KINGDOM_LIST[0].key);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!dream.trim() || !fear.trim() || !strength.trim() || !value.trim() || !goalTitle.trim()) {
      setError("Please answer every question before continuing.");
      return;
    }

    const formData = new FormData();
    formData.set("dream", dream);
    formData.set("fear", fear);
    formData.set("strength", strength);
    formData.set("value", value);
    formData.set("goalTitle", goalTitle);
    formData.set("goalKingdom", goalKingdom);
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");

    startTransition(async () => {
      try {
        await completeOnboarding(formData);
      } catch (err) {
        // redirect() inside the server action throws a special error whose
        // digest starts with NEXT_REDIRECT; let it propagate so navigation
        // actually happens instead of being swallowed as a form error.
        const digest = (err as { digest?: string })?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-5">
        <legend className="mb-1 font-display text-sm uppercase tracking-[0.25em] text-gold">
          Who you are
        </legend>

        <label className="flex flex-col gap-1.5 text-sm text-parchment-dim">
          What is your biggest dream?
          <input
            className={inputClass}
            value={dream}
            onChange={(e) => setDream(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-parchment-dim">
          What is your biggest fear?
          <input
            className={inputClass}
            value={fear}
            onChange={(e) => setFear(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-parchment-dim">
          What is your greatest strength?
          <input
            className={inputClass}
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-parchment-dim">
          Name a core value you hold.
          <input
            className={inputClass}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-5 border-t border-ink-border pt-6">
        <legend className="mb-1 font-display text-sm uppercase tracking-[0.25em] text-gold">
          Your first goal
        </legend>

        <label className="flex flex-col gap-1.5 text-sm text-parchment-dim">
          What do you want to achieve?
          <input
            className={inputClass}
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="e.g. Run a 10k by autumn"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-parchment-dim">
          Kingdom
          <select
            className={inputClass}
            value={goalKingdom}
            onChange={(e) => setGoalKingdom(e.target.value)}
          >
            {KINGDOM_LIST.map((k) => (
              <option key={k.key} value={k.key}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {error && <p className="text-sm text-crimson-bright">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-gold/60 bg-ink-raised px-4 py-2.5 font-display text-sm tracking-wide text-gold-bright transition-colors hover:border-gold hover:bg-ink-border disabled:opacity-50"
      >
        {isPending ? "Beginning..." : "Begin your story"}
      </button>
    </form>
  );
}
