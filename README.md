# Mythos

Mythos turns your real life into a daily-updating epic. Every morning it writes the next chapter of your own story — narrating your actual goals as kingdoms you rule — and asks you to complete a few concrete quests in the real world before the next chapter can be written.

![screenshot placeholder](docs/screenshot-journey.png)
<!-- TODO: replace with a real screenshot of /journey -->

**Live:** [mythos.example.com](#) <!-- TODO: replace with the deployed URL -->

## How it works

1. **Identity** — onboarding captures your deepest dream, your greatest fear, your greatest strength, and a core value. This becomes the narrative voice of every chapter that follows.
2. **Kingdoms** — your real-world goals are sorted into six fixed life domains (Kingdom of Iron for fitness, Library of Wisdom for learning, House of Bonds for relationships, Guild of Builders for career, Treasury for money, Temple for mind). Each kingdom maps to one character stat.
3. **Daily chapter** — once a day (by hand, or automatically overnight via cron), the AI narrator writes one unified chapter weaving together whichever kingdoms are active, referencing what happened in your previous chapter, and hands you 2–4 concrete quests tagged to the kingdoms they serve.
4. **Quests** — you complete them in real life and check them off. Each completed quest immediately awards its kingdom's stat.
5. **Reflection** — at the end of the day you write, in your own words, what actually happened. The AI extracts mood, wins, and setbacks from that text, and this becomes the memory the next chapter draws on.
6. **Stats** — six character stats (discipline, strength, wisdom, calm, honor, charisma) rise and fall as a direct ledger of quests completed, never inferred from prose.
7. **The Book** — compose any span of at least three chapters into a single retrospective narrative: a period summary with a title, a unified story arc, and a stat-delta snapshot, provenance-linked back to the exact chapters it was derived from.

## Architecture

- **Next.js App Router** — server actions for all mutations, server components for data loading, no client-side data-fetching layer.
- **Supabase** — Postgres for storage, built-in auth (magic link + email/password), and Row Level Security enforced on every table.
- **Gemini**, isolated behind [`lib/ai.ts`](src/lib/ai.ts) — every model call (chapter generation, reflection extraction, Book composition) lives behind this one module, so swapping providers or moving to a paid tier touches one file.
- **Vercel cron** — a single scheduled job (`vercel.json`) hits `/api/cron/daily-chapters` once a day; the route itself scans every opted-in user and, for each one, checks whether it's currently their local morning before generating anything.

## Notable engineering decisions

- **RLS on every table, no exceptions.** `profiles`, `goals`, `chapters`, `stats`, `stat_events`, and `books` all enforce `user_id = auth.uid()` (or `id = auth.uid()` for profiles) at the database layer, not just in application code — so a bug in a server action can't leak cross-user data.
- **Service-role access isolated to a single path.** The only code that ever uses the Supabase service role key (which bypasses RLS) is [`src/utils/supabase/admin.ts`](src/utils/supabase/admin.ts), and the only caller of that is the cron route. Every query made through it still filters by `user_id` explicitly in application code, as a second layer of defense on top of the isolation itself.
- **Idempotent cron.** Vercel's cron delivery is at-least-once, not exactly-once — a job can fire twice. `generateDailyChapter` checks for an existing chapter in the user's *local* day before writing a new one, so a duplicate invocation is a safe no-op rather than a duplicate chapter.
- **Timezone-correct day boundaries.** "Today" is computed per-user from their stored IANA timezone (`Intl.DateTimeFormat`), not server time or UTC — otherwise a user in a timezone ahead of or behind the server would get their chapter at the wrong local hour, or get skipped/duplicated across the UTC day boundary.
- **AI output constrained by JSON schema, then defensively re-validated.** Every Gemini call passes a strict `responseSchema`, but the response is still parsed and shape-checked in code afterward (unknown fields dropped, invalid kingdom keys filtered out of quests, empty-quest responses rejected) rather than trusted blindly — model output is treated as untrusted input even when a schema was requested.
- **Provenance on generated Books.** Every `books` row stores `source_chapter_ids`, the exact chapter IDs that fed its generation, so a Book's claims can always be traced back to the source chapters rather than trusted as an opaque summary.

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a Supabase project, then apply the schema: open the SQL editor and run the contents of [`supabase/schema.sql`](supabase/schema.sql) — it's the canonical, idempotent schema (safe to re-run) and already includes RLS policies for every table.
3. Copy the env template and fill in real values:
   ```bash
   cp .env.local.example .env.local
   ```
   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (service_role key — server-only, never expose) |
   | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) |
   | `CRON_SECRET` | any value for local testing; Vercel provisions this automatically in production |
4. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).
