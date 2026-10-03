import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { aiPermissions, studySessions, type User } from "@/server/db/schema";
import { ADVISOR_QUESTIONS, askAdvisor, permissionsFor } from "@/server/services/advisor";
import { createMedication, logMedicationDose, logPrayer } from "@/server/services/life";
import { cleanupUser, makeUser, TEST_TZ } from "./helpers";

let user: User;
const today = new Date().toISOString().slice(0, 10);
const shift = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  user = await makeUser("advisor");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("advisor questions", () => {
  it("every suggested question is handled, not falling through to the default arm", async () => {
    for (const question of ADVISOR_QUESTIONS) {
      const advice = await askAdvisor(user.id, question, TEST_TZ);
      expect(advice.question).toBe(question);
      expect(advice.answer.length).toBeGreaterThan(0);
      expect(advice.answer).not.toContain("not supported");
      expect(advice.mode).toBe("deterministic");
    }
  });

  it("persists each answer with the context it actually read", async () => {
    const advice = await askAdvisor(user.id, "How has my study time changed?", TEST_TZ);
    expect(advice.contextUsed).toContain("study_sessions");
    expect(advice.id).toBeTruthy();
  });
});

describe("study trend answer", () => {
  it("says plainly when there is nothing to compare", async () => {
    const advice = await askAdvisor(user.id, "How has my study time changed?", TEST_TZ);
    expect(advice.answer).toContain("No self-study in the last 30 days");
  });

  it("reports a real comparison once sessions exist", async () => {
    const now = Date.now();
    // 4,500s in this window, 1,800s in the previous one.
    await db.insert(studySessions).values([
      {
        userId: user.id, title: "Recent", status: "completed",
        startedAt: new Date(now - 2 * 86_400_000), endedAt: new Date(now - 2 * 86_400_000 + 3600_000),
        durationSeconds: 3600, accumulatedSeconds: 3600,
      },
      {
        userId: user.id, title: "Recent 2", status: "completed",
        startedAt: new Date(now - 3 * 86_400_000), endedAt: new Date(now - 3 * 86_400_000 + 900_000),
        durationSeconds: 900, accumulatedSeconds: 900,
      },
      {
        userId: user.id, title: "Older window", status: "completed",
        startedAt: new Date(now - 45 * 86_400_000), endedAt: new Date(now - 45 * 86_400_000 + 1800_000),
        durationSeconds: 1800, accumulatedSeconds: 1800,
      },
    ]);

    const advice = await askAdvisor(user.id, "How has my study time changed?", TEST_TZ);
    expect(advice.answer).toContain("over 2 of 30 days");
    expect(advice.rationale).toContain("up 150%");
    expect(advice.rationale).toContain("university class time is excluded");
  });
});

describe("prayer answer is gated and honest", () => {
  it("refuses while the prayer permission is off, which is the default", async () => {
    const permissions = await permissionsFor(user.id);
    expect(permissions.prayer).toBe(false);

    const advice = await askAdvisor(user.id, "How consistent is my prayer?", TEST_TZ);
    expect(advice.answer).toContain("switched off");
    expect(advice.contextUsed).toContain("blocked:prayer");
    expect(advice.contextUsed).not.toContain("prayer_logs");
  });

  it("reports the log as written once permission is granted", async () => {
    await db.update(aiPermissions).set({ prayer: true }).where(eq(aiPermissions.userId, user.id));

    for (const prayer of ["fajr", "dhuhr", "asr", "maghrib"] as const) {
      await logPrayer({ userId: user.id, prayer, day: today, status: "on_time" });
    }
    await logPrayer({ userId: user.id, prayer: "isha", day: today, status: "missed" });

    const advice = await askAdvisor(user.id, "How consistent is my prayer?", TEST_TZ);
    expect(advice.contextUsed).toContain("prayer_logs");
    expect(advice.answer).toContain("% on time over the last 30 days");
    expect(advice.rationale).toContain("1 missed");
    // The streak must not count today: isha is marked missed.
    expect(advice.answer).toContain("current streak 0 days");
    expect(advice.rationale).toContain("nothing is inferred");
  });
});

describe("medication answer is gated and never prescriptive", () => {
  it("refuses while the medication permission is off, which is the default", async () => {
    const permissions = await permissionsFor(user.id);
    expect(permissions.medication).toBe(false);

    const advice = await askAdvisor(user.id, "Am I keeping up with my medication?", TEST_TZ);
    expect(advice.answer).toContain("switched off");
    expect(advice.contextUsed).toContain("blocked:medication");
  });

  it("reports adherence without recommending any change", async () => {
    await db.update(aiPermissions).set({ medication: true }).where(eq(aiPermissions.userId, user.id));

    const medication = await createMedication({ userId: user.id, name: "Iron", dose: "65 mg", times: ["09:00"] });
    await logMedicationDose({
      userId: user.id,
      medicationId: medication.id,
      scheduledAt: new Date(`${shift(-1)}T09:00:00`),
      status: "taken",
    });
    await logMedicationDose({
      userId: user.id,
      medicationId: medication.id,
      scheduledAt: new Date(`${shift(-2)}T09:00:00`),
      status: "missed",
    });

    const advice = await askAdvisor(user.id, "Am I keeping up with my medication?", TEST_TZ);
    expect(advice.contextUsed).toEqual(expect.arrayContaining(["medications", "medication_logs"]));
    expect(advice.answer).toMatch(/^\d+ of \d+ scheduled doses taken in the last 7 days\.$/);
    // It must stay a log, not medical advice.
    expect(advice.rationale).toContain("does not recommend changing, skipping or adjusting any dose");
    expect(advice.rationale.toLowerCase()).not.toContain("you should take");
  });
});
