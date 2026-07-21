import { GoogleGenAI, Type } from "@google/genai";
import { KINGDOMS, type KingdomKey } from "./kingdoms";

// "gemini-flash-latest" is Google's alias that always points at the current
// recommended free-tier Flash model, so it survives model retirements (pinned
// ids like "gemini-2.5-flash" get cut off from new API keys over time).
// Confirm in Google AI Studio (https://aistudio.google.com/) if issues arise.
const MODEL_ID = "gemini-flash-latest";

export type Quest = {
  text: string;
  done: boolean;
  // Optional because quests written before Phase 4 have no kingdom — treat
  // a missing value as unassigned, never backfill it.
  kingdom?: KingdomKey;
};

export type Chapter = {
  title: string;
  narrative: string;
  quests: Quest[];
};

export type Identity = {
  dream: string;
  fear: string;
  strength: string;
  value: string;
};

export type PreviousContext = {
  title: string;
  summary: string;
  wins: string[];
  setbacks: string[];
} | null;

export const STAT_NAMES = [
  "discipline",
  "strength",
  "wisdom",
  "calm",
  "honor",
  "charisma",
] as const;

export type StatName = (typeof STAT_NAMES)[number];

export type StatChange = {
  stat: StatName;
  delta: number;
  reason: string;
};

export type ReflectionExtracted = {
  mood: string;
  wins: string[];
  setbacks: string[];
  summary: string;
};

export type BookChapterInput = {
  number: number;
  title: string;
  reflectionSummary: string | null;
  mood: string | null;
  wins: string[];
  setbacks: string[];
};

export type StatDelta = {
  stat: StatName;
  net: number;
};

export type QuestsCompletedByKingdom = {
  kingdom: string;
  count: number;
};

export type Book = {
  title: string;
  narrative: string;
};

// Each kingdom drives exactly one stat. Completing a quest tagged with a
// kingdom directly awards its stat — see toggleQuest in journey/actions.ts.
// Stats no longer come from parsing the reflection text.
export const KINGDOM_STAT: Record<KingdomKey, StatName> = {
  fitness: "strength",
  learning: "wisdom",
  relationships: "charisma",
  career: "honor",
  money: "discipline",
  mind: "calm",
};

export type GoalInput = { title: string; kingdom: KingdomKey };

type GenerateChapterInput = {
  identity: Identity;
  goals: GoalInput[];
  // Kingdoms with an active goal but zero completed quests in the last 7
  // days. Only these may be described as weakened — never invent neglect.
  neglectedKingdoms: KingdomKey[];
  chapterNumber: number;
  previousContext?: PreviousContext;
};

function buildResponseSchema(kingdomKeys: KingdomKey[]) {
  return {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      narrative: { type: Type.STRING },
      quests: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            kingdom: { type: Type.STRING, enum: kingdomKeys },
          },
          required: ["text", "kingdom"],
        },
      },
    },
    required: ["title", "narrative", "quests"],
  };
}

function buildPreviousContextSection(previousContext: PreviousContext): string {
  if (!previousContext) return "";

  const wins =
    previousContext.wins.length > 0 ? `Wins: ${previousContext.wins.join("; ")}` : "";
  const setbacks =
    previousContext.setbacks.length > 0
      ? `Setbacks: ${previousContext.setbacks.join("; ")}`
      : "";

  return `

What happened in the previous chapter ("${previousContext.title}"): ${previousContext.summary}
${wins}
${setbacks}
This chapter must acknowledge what happened in the previous chapter, using ONLY the facts given above — do not invent events that were not stated. Setbacks should weaken the "kingdom" or raise the stakes; wins should strengthen it.`;
}

function buildGoalsSection(goals: GoalInput[]): string {
  return goals.map((g) => `- ${KINGDOMS[g.kingdom]} (kingdom key: ${g.kingdom}): "${g.title}"`).join("\n");
}

function buildNeglectSection(neglectedKingdoms: KingdomKey[]): string {
  if (neglectedKingdoms.length === 0) return "";
  const names = neglectedKingdoms.map((k) => KINGDOMS[k]).join(", ");
  return `\n\nThe following kingdoms have been neglected — no quest tied to them has been completed in the last 7 days: ${names}. The narrative may acknowledge that these specific kingdoms have weakened, but ONLY because that fact is given to you here — never invent or imply neglect for any kingdom not listed above.`;
}

function buildPrompt({
  identity,
  goals,
  neglectedKingdoms,
  chapterNumber,
  previousContext,
}: GenerateChapterInput) {
  return `You are the narrator of a dark, elegant, cinematic epic — think Game of Thrones crossed with Persona 5. You are writing chapter ${chapterNumber} of the reader's own story, addressed to them in second person ("you"). The reader rules several kingdoms, each a real-world goal in a different domain of their life.

The reader:
- Their deepest dream: ${identity.dream}
- Their greatest fear: ${identity.fear}
- Their greatest strength: ${identity.strength}
- A core value they hold: ${identity.value}

Their active kingdoms and the real-world goal each represents:
${buildGoalsSection(goals)}
${buildNeglectSection(neglectedKingdoms)}
${buildPreviousContextSection(previousContext ?? null)}

Write ONE single, unified chapter that weaves together whichever of these kingdoms are relevant today into one continuous narrative — do NOT write separate sections, headers, or paragraphs per kingdom or goal. This is one story with one throughline, even though it touches multiple kingdoms. Weave in the reader's dream, fear, strength, and value as narrative texture, not as a checklist. Tone: dark, elegant, cinematic prose. Keep the narrative between 120 and 180 words.

Then produce between 2 and 4 concrete, real-world quests TOTAL across ALL kingdoms combined — not per kingdom. Each quest must be a small, specific, actionable task the reader can actually go do today or this week, phrased in the voice of the story, and each must be tagged with the kingdom key (from the list above) it serves.

For the title, write only the chapter's name itself — do not prefix it with "Chapter ${chapterNumber}" or any chapter number, since that is added separately by the app.

Respond with JSON matching the provided schema only.`;
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

export async function generateChapter(
  input: GenerateChapterInput,
): Promise<Chapter> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  if (input.goals.length === 0) {
    throw new Error("Chapter generation failed: no active goals were provided");
  }

  const ai = new GoogleGenAI({ apiKey });
  const kingdomKeys = input.goals.map((g) => g.kingdom);

  let rawText: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: buildPrompt(input),
      config: {
        responseMimeType: "application/json",
        responseSchema: buildResponseSchema(kingdomKeys),
      },
    });
    rawText = response.text;
  } catch (err) {
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? ` — cause: ${err.cause.message}`
        : "";
    throw new Error(
      `Chapter generation failed: request to the AI provider errored (${
        err instanceof Error ? err.message : String(err)
      }${cause})`,
    );
  }

  if (!rawText) {
    throw new Error("Chapter generation failed: empty response from AI provider");
  }

  let parsed: { title?: unknown; narrative?: unknown; quests?: unknown };
  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch (err) {
    throw new Error(
      `Chapter generation failed: could not parse AI response as JSON (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  if (
    typeof parsed.title !== "string" ||
    typeof parsed.narrative !== "string" ||
    !Array.isArray(parsed.quests)
  ) {
    throw new Error(
      "Chapter generation failed: AI response did not match the expected shape",
    );
  }

  const kingdomKeySet = new Set<string>(kingdomKeys);

  const quests: Quest[] = parsed.quests
    .filter((q): q is { text: string; kingdom: string } => {
      if (typeof q !== "object" || q === null) return false;
      const candidate = q as { text?: unknown; kingdom?: unknown };
      return (
        typeof candidate.text === "string" &&
        typeof candidate.kingdom === "string" &&
        kingdomKeySet.has(candidate.kingdom)
      );
    })
    .map((q) => ({ text: q.text, done: false, kingdom: q.kingdom as KingdomKey }));

  if (quests.length === 0) {
    throw new Error("Chapter generation failed: AI response contained no valid quests");
  }

  const title = parsed.title.replace(/^chapter\s+\d+\s*[:.\-–—]\s*/i, "").trim();

  return {
    title: title || parsed.title,
    narrative: parsed.narrative,
    quests,
  };
}

const reflectionSchema = {
  type: Type.OBJECT,
  properties: {
    mood: { type: Type.STRING },
    wins: { type: Type.ARRAY, items: { type: Type.STRING } },
    setbacks: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
  },
  required: ["mood", "wins", "setbacks", "summary"],
};

function buildReflectionPrompt(rawText: string): string {
  return `The reader just wrote a short reflection on what happened in today's chapter of their story, in their own words:

"""
${rawText}
"""

Extract structured data from this reflection, using only what is actually stated — do not invent or infer details that aren't present.

Respond with JSON matching the schema:
- mood: one or two words capturing their overall emotional state (e.g. "proud", "discouraged", "steady")
- wins: a short list of concrete positive things they described (empty array if none)
- setbacks: a short list of concrete struggles or setbacks they described (empty array if none)
- summary: one sentence, in plain language, summarizing what happened`;
}

export async function extractReflection(rawText: string): Promise<ReflectionExtracted> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });

  let responseText: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: buildReflectionPrompt(rawText),
      config: {
        responseMimeType: "application/json",
        responseSchema: reflectionSchema,
      },
    });
    responseText = response.text;
  } catch (err) {
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? ` — cause: ${err.cause.message}`
        : "";
    throw new Error(
      `Reflection extraction failed: request to the AI provider errored (${
        err instanceof Error ? err.message : String(err)
      }${cause})`,
    );
  }

  if (!responseText) {
    throw new Error("Reflection extraction failed: empty response from AI provider");
  }

  let parsed: {
    mood?: unknown;
    wins?: unknown;
    setbacks?: unknown;
    summary?: unknown;
  };
  try {
    parsed = JSON.parse(stripJsonFences(responseText));
  } catch (err) {
    throw new Error(
      `Reflection extraction failed: could not parse AI response as JSON (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  if (
    typeof parsed.mood !== "string" ||
    typeof parsed.summary !== "string" ||
    !Array.isArray(parsed.wins) ||
    !Array.isArray(parsed.setbacks)
  ) {
    throw new Error(
      "Reflection extraction failed: AI response did not match the expected shape",
    );
  }

  const wins = parsed.wins.filter((w): w is string => typeof w === "string");
  const setbacks = parsed.setbacks.filter((s): s is string => typeof s === "string");

  return {
    mood: parsed.mood,
    wins,
    setbacks,
    summary: parsed.summary,
  };
}

type GenerateBookInput = {
  identity: Identity;
  periodLabel: string;
  chapters: BookChapterInput[];
  statDeltas: StatDelta[];
  questsCompleted: QuestsCompletedByKingdom[];
  kingdoms: string[];
};

const bookSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    narrative: { type: Type.STRING },
  },
  required: ["title", "narrative"],
};

function buildBookChaptersSection(chapters: BookChapterInput[]): string {
  return chapters
    .map((c) => {
      const parts = [`Chapter ${c.number}: "${c.title}"`];
      if (c.mood) parts.push(`mood: ${c.mood}`);
      if (c.reflectionSummary) parts.push(`what happened: ${c.reflectionSummary}`);
      if (c.wins.length > 0) parts.push(`wins: ${c.wins.join("; ")}`);
      if (c.setbacks.length > 0) parts.push(`setbacks: ${c.setbacks.join("; ")}`);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}

function buildStatDeltasSection(statDeltas: StatDelta[]): string {
  const nonZero = statDeltas.filter((s) => s.net !== 0);
  if (nonZero.length === 0) return "No measurable stat movement this period.";
  return nonZero.map((s) => `${s.stat} ${s.net > 0 ? "+" : ""}${s.net}`).join(", ");
}

function buildQuestsCompletedSection(questsCompleted: QuestsCompletedByKingdom[]): string {
  if (questsCompleted.length === 0) return "No quests were completed this period.";
  return questsCompleted.map((q) => `${q.kingdom}: ${q.count} completed`).join(", ");
}

function buildBookPrompt(input: GenerateBookInput): string {
  return `You are the narrator of a dark, elegant, cinematic epic — the same voice that writes the reader's daily chapters. You are now writing a Book: a period summary covering ${input.periodLabel}, addressed to the reader in second person ("you").

The reader:
- Their deepest dream: ${input.identity.dream}
- Their greatest fear: ${input.identity.fear}
- Their greatest strength: ${input.identity.strength}
- A core value they hold: ${input.identity.value}

Their active kingdoms during this period: ${input.kingdoms.length > 0 ? input.kingdoms.join(", ") : "none currently active"}.

The record of what happened, chapter by chapter — this is the ONLY source of truth for this period. Do not use anything not stated here:
${buildBookChaptersSection(input.chapters)}

Quests completed by kingdom this period (evidence, not content to recite): ${buildQuestsCompletedSection(input.questsCompleted)}
Stat movement this period (evidence, not content to recite): ${buildStatDeltasSection(input.statDeltas)}

Write a Book: a single coherent narrative of this period, 250 to 400 words, in the same dark, elegant, cinematic second-person voice as the chapters. Rules:
- Narrate the period as an arc with a real shape — what dominated, what was avoided, what shifted between the start and the end of the period. Name the tension honestly.
- A period of mostly failure, stagnation, or avoidance is a valid and more interesting story than a fake triumph — do not manufacture growth, resolution, or drama that isn't in the record above.
- Reference ONLY events, moods, wins, and setbacks that appear in the chapter record above. Never invent an event, a feeling, or a person that isn't stated there.
- Do not list, recite, or enumerate the stat numbers or quest counts directly in the prose — they are evidence that should inform the tone and shape of the story, never content that appears as numbers or tallies.
- If the record above is thin (few chapters, little in the reflections), write something short and honest about a quiet, uneventful period rather than padding it with invented incident. It is fine, and preferable, for the Book to land on the shorter end of the range in that case.

For the title, write a book/chapter-style title, e.g. "Book I: The Architect's Resolve" — evocative, not literal, and not a restatement of the period's dates.

Respond with JSON matching the provided schema only.`;
}

export async function generateBook(input: GenerateBookInput): Promise<Book> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  if (input.chapters.length === 0) {
    throw new Error("Book generation failed: no chapters were provided");
  }

  const ai = new GoogleGenAI({ apiKey });

  let rawText: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: buildBookPrompt(input),
      config: {
        responseMimeType: "application/json",
        responseSchema: bookSchema,
      },
    });
    rawText = response.text;
  } catch (err) {
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? ` — cause: ${err.cause.message}`
        : "";
    throw new Error(
      `Book generation failed: request to the AI provider errored (${
        err instanceof Error ? err.message : String(err)
      }${cause})`,
    );
  }

  if (!rawText) {
    throw new Error("Book generation failed: empty response from AI provider");
  }

  let parsed: { title?: unknown; narrative?: unknown };
  try {
    parsed = JSON.parse(stripJsonFences(rawText));
  } catch (err) {
    throw new Error(
      `Book generation failed: could not parse AI response as JSON (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  if (typeof parsed.title !== "string" || typeof parsed.narrative !== "string") {
    throw new Error("Book generation failed: AI response did not match the expected shape");
  }

  return {
    title: parsed.title,
    narrative: parsed.narrative,
  };
}
