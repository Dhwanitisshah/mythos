import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { SignOutButton } from "./sign-out-button";

export default async function JourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Welcome, {user.email}</h1>
      <SignOutButton />
    </main>
  );
}
