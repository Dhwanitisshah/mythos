"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  extractReflection,
  generateChapter,
  type Identity,
  type PreviousContext,
  type Quest,
  type ReflectionExtracted,
} from "@/lib/ai";

export async function beginTodaysChapter(goalId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("identity")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Could not load your profile");
  }

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id, title, category")
    .eq("id", goalId)
    .single();

  if (goalError || !goal) {
    throw new Error("Could not load your goal");
  }

  const { count, error: countError } = await supabase
    .from("chapters")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", goal.id);

  if (countError) {
    throw new Error("Could not determine the next chapter number");
  }

  const chapterNumber = (count ?? 0) + 1;

  const { data: priorChapters, error: priorError } = await supabase
    .from("chapters")
    .select("title, reflection_extracted")
    .eq("goal_id", goal.id)
    .not("reflection_extracted", "is", null)
    .order("chapter_number", { ascending: false })
    .limit(1);

  if (priorError) {
    throw new Error("Could not load prior chapter memory");
  }

  const priorChapter = priorChapters?.[0] ?? null;
  const previousContext: PreviousContext = priorChapter
    ? (() => {
        const extracted = priorChapter.reflection_extracted as ReflectionExtracted;
        return {
          title: priorChapter.title,
          summary: extracted.summary,
          wins: extracted.wins,
          setbacks: extracted.setbacks,
        };
      })()
    : null;

  const chapter = await generateChapter({
    identity: profile.identity as Identity,
    goal: { title: goal.title, category: goal.category },
    chapterNumber,
    previousContext,
  });

  const { error: insertError } = await supabase.from("chapters").insert({
    user_id: user.id,
    goal_id: goal.id,
    chapter_number: chapterNumber,
    title: chapter.title,
    narrative: chapter.narrative,
    quests: chapter.quests,
  });

  if (insertError) {
    throw new Error(`Failed to save chapter: ${insertError.message}`);
  }

  revalidatePath("/journey");
}

export async function toggleQuest(chapterId: string, questIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: chapter, error: fetchError } = await supabase
    .from("chapters")
    .select("quests")
    .eq("id", chapterId)
    .single();

  if (fetchError || !chapter) {
    throw new Error("Could not load chapter");
  }

  const quests = chapter.quests as Quest[];
  if (!quests[questIndex]) {
    throw new Error("Quest not found");
  }

  quests[questIndex] = { ...quests[questIndex], done: !quests[questIndex].done };

  const { error: updateError } = await supabase
    .from("chapters")
    .update({ quests })
    .eq("id", chapterId);

  if (updateError) {
    throw new Error(`Failed to update quest: ${updateError.message}`);
  }

  revalidatePath("/journey");
}

export async function submitReflection(chapterId: string, text: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Reflection cannot be empty");
  }

  const extracted = await extractReflection(trimmed);

  const { error: updateError } = await supabase
    .from("chapters")
    .update({
      reflection: trimmed,
      reflection_extracted: extracted,
      reflected_at: new Date().toISOString(),
    })
    .eq("id", chapterId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error(`Failed to save reflection: ${updateError.message}`);
  }

  revalidatePath("/journey");
}

export async function setProfileTimezone(timezone: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!timezone.trim()) {
    return;
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id);

  if (updateError) {
    throw new Error(`Failed to save timezone: ${updateError.message}`);
  }

  revalidatePath("/journey");
}
