import { GoogleGenAI, Type } from "@google/genai";

// "gemini-flash-latest" is Google's alias that always points at the current
// recommended free-tier Flash model, so it survives model retirements (pinned
// ids like "gemini-2.5-flash" get cut off from new API keys over time).
// Confirm in Google AI Studio (https://aistudio.google.com/) if issues arise.
const MODEL_ID = "gemini-flash-latest";

export type Quest = {
  text: string;
  done: boolean;
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

export type ReflectionExtracted = {
  mood: string;
  wins: string[];
  setbacks: string[];
  summary: string;
};

type GenerateChapterInput = {
  identity: Identity;
  goal: { title: string; category: string };
  chapterNumber: number;
  previousContext?: PreviousContext;
};

const responseSchema = {
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
        },
        required: ["text"],
      },
    },
  },
  required: ["title", "narrative", "quests"],
};

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

function buildPrompt({ identity, goal, chapterNumber, previousContext }: GenerateChapterInput) {
  return `You are the narrator of a dark, elegant, cinematic epic — think Game of Thrones crossed with Persona 5. You are writing chapter ${chapterNumber} of the reader's own story, addressed to them in second person ("you").

The reader:
- Their deepest dream: ${identity.dream}
- Their greatest fear: ${identity.fear}
- Their greatest strength: ${identity.strength}
- A core value they hold: ${identity.value}

Their current real-world goal (category: ${goal.category}): "${goal.title}"
${buildPreviousContextSection(previousContext ?? null)}

Write this chapter so it transforms their real goal into a mythic story beat — treat the goal as a trial, quest, or turning point in an unfolding saga. Weave in their dream, fear, strength, and value as narrative texture, not as a checklist. Tone: dark, elegant, cinematic prose. Keep the narrative between 120 and 180 words.

Then produce 2-3 concrete, real-world quests (small, specific, actionable tasks the reader can actually go do today or this week) that would advance their goal. Phrase each quest in the voice of the story (as if it were a task assigned within the narrative), but it must map to a real, doable action.

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

  const ai = new GoogleGenAI({ apiKey });

  let rawText: string | undefined;
  try {
    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: buildPrompt(input),
      config: {
        responseMimeType: "application/json",
        responseSchema,
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

  const quests: Quest[] = parsed.quests
    .filter(
      (q): q is { text: string } =>
        typeof q === "object" && q !== null && typeof (q as { text?: unknown }).text === "string",
    )
    .map((q) => ({ text: q.text, done: false }));

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

  let parsed: { mood?: unknown; wins?: unknown; setbacks?: unknown; summary?: unknown };
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
