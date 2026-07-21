"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { generateBookForPeriod, type BookRecord } from "@/lib/generate-book";

export async function composeBook(
  startDate: string,
  endDate: string,
): Promise<{ book: BookRecord }> {
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
      return { book: result.book };
    case "existing":
      return { book: result.book };
    case "insufficient":
      throw new Error(result.message);
    case "error":
      throw new Error(result.message);
  }
}
