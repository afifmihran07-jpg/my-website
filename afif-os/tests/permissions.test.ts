import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { aiPermissions, type User } from "@/server/db/schema";
import { ADVISOR_QUESTIONS, advisorHistory, askAdvisor, deniedModules, hasAccess, permissionsFor } from "@/server/services/advisor";
import { TEST_TZ, cleanupUser, makeUser } from "./helpers";

let user: User;

beforeAll(async () => {
  user = await makeUser("privacy");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("AI permissions", () => {
  it("creates a permission row with sensitive modules off by default", async () => {
    const permissions = await permissionsFor(user.id);
    expect(permissions.academic).toBe(true);
    expect(permissions.tasks).toBe(true);
    expect(permissions.diary).toBe(false);
    expect(permissions.photos).toBe(false);
    expect(permissions.medication).toBe(false);
    expect(permissions.prayer).toBe(false);
  });

  it("never grants a sensitive module implicitly", async () => {
    const permissions = await permissionsFor(user.id);
    for (const module of ["diary", "photos", "medication", "prayer"] as const) {
      expect(hasAccess(permissions, module)).toBe(false);
    }
  });

  it("lists the modules the advisor is not allowed to read", async () => {
    const permissions = await permissionsFor(user.id);
    const denied = deniedModules(permissions);
    expect(denied).toContain("diary");
    expect(denied).toContain("medication");
    expect(denied).not.toContain("tasks");
  });

  it("honours an explicit opt-in for a sensitive module", async () => {
    await db.update(aiPermissions).set({ diary: true }).where(eq(aiPermissions.userId, user.id));
    const permissions = await permissionsFor(user.id);
    expect(hasAccess(permissions, "diary")).toBe(true);

    await db.update(aiPermissions).set({ diary: false }).where(eq(aiPermissions.userId, user.id));
    const revoked = await permissionsFor(user.id);
    expect(hasAccess(revoked, "diary")).toBe(false);
  });

  it("refuses to use study data when the study permission is off", async () => {
    await db.update(aiPermissions).set({ study: false }).where(eq(aiPermissions.userId, user.id));

    const advice = await askAdvisor(user.id, "Review my week.", TEST_TZ);
    expect(advice.answer).toMatch(/switched off/i);
    expect(advice.contextUsed).toContain("blocked:study");

    await db.update(aiPermissions).set({ study: true }).where(eq(aiPermissions.userId, user.id));
  });

  it("refuses to use book data when the books permission is off", async () => {
    await db.update(aiPermissions).set({ books: false }).where(eq(aiPermissions.userId, user.id));
    const advice = await askAdvisor(user.id, "Should I start another book?", TEST_TZ);
    expect(advice.answer).toMatch(/switched off/i);
    expect(advice.contextUsed).toContain("blocked:books");
    await db.update(aiPermissions).set({ books: true }).where(eq(aiPermissions.userId, user.id));
  });

  it("answers every supported question and always gives a reason", async () => {
    for (const question of ADVISOR_QUESTIONS) {
      const advice = await askAdvisor(user.id, question, TEST_TZ);
      expect(advice.answer.length).toBeGreaterThan(0);
      expect(advice.rationale.length).toBeGreaterThan(0);
      expect(advice.mode).toBe("deterministic");
    }
  });

  it("keeps a history of the advice it gave", async () => {
    const history = await advisorHistory(user.id);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]!.rationale.length).toBeGreaterThan(0);
  });
});
