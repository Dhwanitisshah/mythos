"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "./actions";
import { KINGDOM_LIST } from "@/lib/kingdoms";

const inputClass =
  "rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
          Who you are
        </legend>

        <label className="flex flex-col gap-1 text-sm">
          What is your biggest dream?
          <input
            className={inputClass}
            value={dream}
            onChange={(e) => setDream(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          What is your biggest fear?
          <input
            className={inputClass}
            value={fear}
            onChange={(e) => setFear(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          What is your greatest strength?
          <input
            className={inputClass}
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Name a core value you hold.
          <input
            className={inputClass}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
          Your first goal
        </legend>

        <label className="flex flex-col gap-1 text-sm">
          What do you want to achieve?
          <input
            className={inputClass}
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="e.g. Run a 10k by autumn"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {isPending ? "Beginning..." : "Begin your story"}
      </button>
    </form>
  );
}
