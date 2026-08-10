import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

// Real-Supabase RLS data-isolation tests.
//
// These hit the ACTUAL Supabase project the app talks to — not a mock or a
// local Postgres — because Row Level Security is enforced by Postgres
// itself, and the only way to prove it works is to ask the database. Two
// disposable users ("A" and "B") are created via the Supabase Admin API,
// seeded with one row per table as user A, then every assertion tries the
// same operation as user B and expects it to be blocked. Both users are
// deleted in afterAll(); deleting the auth user cascades (via `on delete
// cascade` foreign keys in supabase/schema.sql) to every row created here,
// so there's no separate row cleanup needed.
//
// Required env vars — put them in .env.local (same file the app already
// uses, see .env.local.example). NEVER hardcode credentials in this file:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SUPABASE_SERVICE_ROLE_KEY   (admin-only: create/delete the two test users)
//
// If any of these are absent (e.g. a machine that only has app-level env
// vars, or CI without Supabase secrets configured), the whole suite is
// skipped with a console warning instead of failing — this is a live
// integration test against a real project, not something `next build` or a
// contributor's first `npm test` should ever be blocked by.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasEnv = Boolean(url && anonKey && serviceRoleKey);

if (!hasEnv) {
  console.warn(
    "[rls.test.ts] Skipping RLS isolation tests: set NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local) to run them.",
  );
}

describe.skipIf(!hasEnv)("RLS data isolation", () => {
  let admin: SupabaseClient;
  let userA: SupabaseClient;
  let userB: SupabaseClient;
  let userAId: string;
  let userBId: string;
  let chapterAId: string;

  beforeAll(async () => {
    admin = createSupabaseClient(url!, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const emailA = `mythos-rls-test-a-${suffix}@example.com`;
    const emailB = `mythos-rls-test-b-${suffix}@example.com`;
    const password = `Rls-Test-${suffix}-!Aa1`;

    const { data: createdA, error: createAErr } = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
    });
    if (createAErr || !createdA.user) {
      throw new Error(`Failed to create test user A: ${createAErr?.message}`);
    }
    userAId = createdA.user.id;

    const { data: createdB, error: createBErr } = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    });
    if (createBErr || !createdB.user) {
      throw new Error(`Failed to create test user B: ${createBErr?.message}`);
    }
    userBId = createdB.user.id;

    userA = createSupabaseClient(url!, anonKey!);
    userB = createSupabaseClient(url!, anonKey!);

    const { error: signInAErr } = await userA.auth.signInWithPassword({
      email: emailA,
      password,
    });
    if (signInAErr) throw new Error(`Failed to sign in test user A: ${signInAErr.message}`);

    const { error: signInBErr } = await userB.auth.signInWithPassword({
      email: emailB,
      password,
    });
    if (signInBErr) throw new Error(`Failed to sign in test user B: ${signInBErr.message}`);

    // Seed every table with one row owned by user A, inserted AS user A
    // (this also exercises each table's insert_own policy — if that were
    // broken, the whole suite would fail here rather than silently passing).
    const { error: profileErr } = await userA
      .from("profiles")
      .insert({ id: userAId, identity: {}, timezone: "UTC" });
    if (profileErr) throw new Error(`Seed failed (profiles): ${profileErr.message}`);

    const { error: statsErr } = await userA.from("stats").insert({ user_id: userAId });
    if (statsErr) throw new Error(`Seed failed (stats): ${statsErr.message}`);

    const { data: goalRow, error: goalErr } = await userA
      .from("goals")
      .insert({ user_id: userAId, title: "RLS test goal", category: "test", kingdom: "fitness" })
      .select()
      .single();
    if (goalErr || !goalRow) throw new Error(`Seed failed (goals): ${goalErr?.message}`);

    const { data: chapterRow, error: chapterErr } = await userA
      .from("chapters")
      .insert({
        user_id: userAId,
        goal_id: goalRow.id,
        chapter_number: 1,
        title: "RLS test chapter",
        narrative: "test narrative",
        quests: [],
      })
      .select()
      .single();
    if (chapterErr || !chapterRow) throw new Error(`Seed failed (chapters): ${chapterErr?.message}`);
    chapterAId = chapterRow.id;

    const { error: statEventErr } = await userA.from("stat_events").insert({
      user_id: userAId,
      chapter_id: chapterAId,
      stat: "discipline",
      delta: 1,
      reason: "RLS test",
    });
    if (statEventErr) throw new Error(`Seed failed (stat_events): ${statEventErr.message}`);

    const { error: bookErr } = await userA.from("books").insert({
      user_id: userAId,
      period_start: "2026-01-01",
      period_end: "2026-01-07",
      title: "RLS test book",
      narrative: "test narrative",
      stats_snapshot: {},
      source_chapter_ids: [chapterAId],
    });
    if (bookErr) throw new Error(`Seed failed (books): ${bookErr.message}`);

    const { error: storyStateErr } = await userA.from("story_state").insert({
      user_id: userAId,
      arc_summary: "RLS test arc summary",
      motifs: [],
      recent_openings: [],
    });
    if (storyStateErr) throw new Error(`Seed failed (story_state): ${storyStateErr.message}`);

    const { error: kingdomStateErr } = await userA.from("kingdom_state").insert({
      user_id: userAId,
      kingdom: "fitness",
      prosperity: 50,
    });
    if (kingdomStateErr) throw new Error(`Seed failed (kingdom_state): ${kingdomStateErr.message}`);
  });

  afterAll(async () => {
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  describe("profiles", () => {
    it("user A can read their own profile (positive control)", async () => {
      const { data, error } = await userA.from("profiles").select("*").eq("id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's profile", async () => {
      const { data, error } = await userB.from("profiles").select("*").eq("id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's profile", async () => {
      const { data } = await userB
        .from("profiles")
        .update({ timezone: "Pacific/Auckland" })
        .eq("id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("profiles")
        .select("timezone")
        .eq("id", userAId)
        .single();
      expect(check?.timezone).toBe("UTC");
    });

    it("user B cannot delete user A's profile", async () => {
      const { data } = await userB.from("profiles").delete().eq("id", userAId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin.from("profiles").select("id").eq("id", userAId);
      expect(check).toHaveLength(1);
    });
  });

  describe("stats", () => {
    it("user A can read their own stats (positive control)", async () => {
      const { data, error } = await userA.from("stats").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's stats", async () => {
      const { data, error } = await userB.from("stats").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's stats", async () => {
      const { data } = await userB
        .from("stats")
        .update({ discipline: 999 })
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("stats")
        .select("discipline")
        .eq("user_id", userAId)
        .single();
      expect(check?.discipline).toBe(10);
    });

    it("user B cannot delete user A's stats", async () => {
      const { data } = await userB.from("stats").delete().eq("user_id", userAId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin.from("stats").select("user_id").eq("user_id", userAId);
      expect(check).toHaveLength(1);
    });
  });

  describe("goals", () => {
    it("user A can read their own goal (positive control)", async () => {
      const { data, error } = await userA.from("goals").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's goals", async () => {
      const { data, error } = await userB.from("goals").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's goal", async () => {
      const { data } = await userB
        .from("goals")
        .update({ status: "completed" })
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("goals")
        .select("status")
        .eq("user_id", userAId)
        .single();
      expect(check?.status).toBe("active");
    });

    it("user B cannot delete user A's goal", async () => {
      const { data } = await userB.from("goals").delete().eq("user_id", userAId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin.from("goals").select("id").eq("user_id", userAId);
      expect(check).toHaveLength(1);
    });
  });

  describe("chapters", () => {
    it("user A can read their own chapter (positive control)", async () => {
      const { data, error } = await userA.from("chapters").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's chapters", async () => {
      const { data, error } = await userB.from("chapters").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's chapter", async () => {
      const { data } = await userB
        .from("chapters")
        .update({ title: "Hijacked" })
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("chapters")
        .select("title")
        .eq("user_id", userAId)
        .single();
      expect(check?.title).toBe("RLS test chapter");
    });

    it("user B cannot delete user A's chapter", async () => {
      const { data } = await userB.from("chapters").delete().eq("user_id", userAId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin.from("chapters").select("id").eq("user_id", userAId);
      expect(check).toHaveLength(1);
    });
  });

  // stat_events has ONLY select_own and insert_own policies (see
  // supabase/schema.sql) — it's an intentionally immutable audit log, so
  // there is no update/delete policy for ANYONE, not even the owner. These
  // tests confirm user B is blocked the same way a missing policy blocks
  // everyone; they are not evidence of an owner-specific carve-out.
  describe("stat_events", () => {
    it("user A can read their own stat_event (positive control)", async () => {
      const { data, error } = await userA.from("stat_events").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's stat_events", async () => {
      const { data, error } = await userB.from("stat_events").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's stat_event (no update policy exists at all)", async () => {
      const { data } = await userB
        .from("stat_events")
        .update({ delta: 999 })
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("stat_events")
        .select("delta")
        .eq("user_id", userAId)
        .single();
      expect(check?.delta).toBe(1);
    });

    it("user B cannot delete user A's stat_event (no delete policy exists at all)", async () => {
      const { data } = await userB.from("stat_events").delete().eq("user_id", userAId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("stat_events")
        .select("id")
        .eq("user_id", userAId);
      expect(check).toHaveLength(1);
    });
  });

  describe("books", () => {
    it("user A can read their own book (positive control)", async () => {
      const { data, error } = await userA.from("books").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's books", async () => {
      const { data, error } = await userB.from("books").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's book", async () => {
      const { data } = await userB
        .from("books")
        .update({ title: "Hijacked" })
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("books")
        .select("title")
        .eq("user_id", userAId)
        .single();
      expect(check?.title).toBe("RLS test book");
    });

    it("user B cannot delete user A's book", async () => {
      const { data } = await userB.from("books").delete().eq("user_id", userAId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin.from("books").select("id").eq("user_id", userAId);
      expect(check).toHaveLength(1);
    });
  });

  describe("story_state", () => {
    it("user A can read their own story_state (positive control)", async () => {
      const { data, error } = await userA.from("story_state").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's story_state", async () => {
      const { data, error } = await userB.from("story_state").select("*").eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's story_state", async () => {
      const { data } = await userB
        .from("story_state")
        .update({ arc_summary: "Hijacked" })
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("story_state")
        .select("arc_summary")
        .eq("user_id", userAId)
        .single();
      expect(check?.arc_summary).toBe("RLS test arc summary");
    });

    it("user B cannot delete user A's story_state", async () => {
      const { data } = await userB.from("story_state").delete().eq("user_id", userAId).select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("story_state")
        .select("user_id")
        .eq("user_id", userAId);
      expect(check).toHaveLength(1);
    });
  });

  describe("kingdom_state", () => {
    it("user A can read their own kingdom_state (positive control)", async () => {
      const { data, error } = await userA
        .from("kingdom_state")
        .select("*")
        .eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user B cannot select user A's kingdom_state", async () => {
      const { data, error } = await userB
        .from("kingdom_state")
        .select("*")
        .eq("user_id", userAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("user B cannot update user A's kingdom_state", async () => {
      const { data } = await userB
        .from("kingdom_state")
        .update({ prosperity: 999 })
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("kingdom_state")
        .select("prosperity")
        .eq("user_id", userAId)
        .single();
      expect(check?.prosperity).toBe(50);
    });

    it("user B cannot delete user A's kingdom_state", async () => {
      const { data } = await userB
        .from("kingdom_state")
        .delete()
        .eq("user_id", userAId)
        .select();
      expect(data ?? []).toHaveLength(0);

      const { data: check } = await admin
        .from("kingdom_state")
        .select("user_id")
        .eq("user_id", userAId);
      expect(check).toHaveLength(1);
    });
  });
});
