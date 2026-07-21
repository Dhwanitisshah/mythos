"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded border border-ink-border px-3 py-1.5 text-sm text-parchment-dim transition-colors hover:border-gold/60 hover:text-gold-bright"
    >
      Sign out
    </button>
  );
}
