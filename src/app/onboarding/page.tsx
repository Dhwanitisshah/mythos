import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarded_at) {
    redirect("/journey");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="w-full max-w-lg">
        <h1 className="mb-2 text-2xl font-semibold">Begin your story</h1>
        <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">
          Four questions to know you, and one goal to build the first chapter around.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
