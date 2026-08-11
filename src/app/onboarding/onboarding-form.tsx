"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "./actions";
import { KINGDOM_LIST } from "@/lib/kingdoms";
import { DEFAULT_AVATAR_STYLE, randomSeed, type AvatarStyleKey } from "@/lib/avatar-styles";
import { AvatarStep } from "./avatar-step";

const inputClass =
  "rounded border border-ink-border bg-ink-raised px-3 py-2 text-parchment placeholder:text-parchment-faint focus:border-gold";

export function OnboardingForm() {
  const [dream, setDream] = useState("");
  const [fear, setFear] = useState("");
  const [strength, setStrength] = useState("");
  const [value, setValue] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalKingdom, setGoalKingdom] = useState<string>(KINGDOM_LIST[0].key);
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyleKey>(DEFAULT_AVATAR_STYLE);
  const [avatarSeed, setAvatarSeed] = useState(() => randomSeed());
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
    formData.set("avatarStyle", avatarStyle);
    formData.set("avatarSeed", avatarSeed);
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");

    startTransition(async () => {
      // On success, completeOnboarding calls redirect() internally (which
      // throws a special NEXT_REDIRECT error under the hood) and never
      // returns — so this line only runs for an actual validation/save
      // failure.
      const result = await completeOnboarding(formData);
      setError(result.message);
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

      <AvatarStep
        style={avatarStyle}
        seed={avatarSeed}
        onStyleChange={setAvatarStyle}
        onSeedChange={setAvatarSeed}
      />

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
