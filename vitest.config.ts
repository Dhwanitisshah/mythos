import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Vitest doesn't read .env.local the way `next dev` does, and we don't want
// to add dotenv as a dependency for a few KEY=VALUE lines. Load it manually,
// once, before the test config is built — child test processes inherit
// process.env from this main process.
function loadDotEnvLocal() {
  const path = resolve(__dirname, ".env.local");
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvLocal();

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // RLS tests hit a real network (Supabase) and create/sign-in/delete users.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
