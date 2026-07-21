"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { generateBookForPeriod, type BookRecord } from "@/lib/generate-book";

export type ComposeBookResult =
  | { ok: true; book: BookRecord }
  | { ok: false; reason: "insufficient-record" | "generation-failed"; message: string };

export async function composeBook(
  startDate: string,
  endDate: string,
): Promise<ComposeBookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const result = await generateBookForPeriod(supabase, user.id, startDate, endDate);

  switch (result.status) {
    case "created":
      revalidatePath("/library");
      return { ok: true, book: result.book };
    case "existing":
      return { ok: true, book: result.book };
    case "insufficient":
      return { ok: false, reason: "insufficient-record", message: result.message };
    case "error":
      return { ok: false, reason: "generation-failed", message: result.message };
  }
}
