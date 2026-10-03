import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { activities, diaryEntries, medicationLogs, prayerLogs, type User } from "@/server/db/schema";
import {
  addPhoto,
  archiveDiaryEntry,
  createActivity,
  createMedication,
  createMilestone,
  createTimelineEvent,
  deleteMilestone,
  deletePrayerLog,
  deleteTimelineEvent,
  dosesDueToday,
  getDiaryEntry,
  lifeSummary,
  listActivities,
  listDiary,
  listMedications,
  listMilestones,
  listPhotos,
  listReflections,
  listTimeline,
  logMedicationDose,
  logPrayer,
  medicationAdherence,
  prayerDay,
  prayerStats,
  prayerStreak,
  saveDiaryEntry,
  saveReflection,
  updateActivity,
  updateMedication,
  updatePhoto,
} from "@/server/services/life";
import { REFLECTION_FIELDS } from "@/server/services/life";
import { cleanupUser, makeUser } from "./helpers";

let user: User;
const today = new Date().toISOString().slice(0, 10);
const shift = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  user = await makeUser("life");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

/* -------------------------------- activities ------------------------------- */

describe("activities", () => {
  it("derives duration from the timestamps instead of trusting an entered number", async () => {
    const start = new Date("2026-01-10T06:00:00Z");
    const end = new Date("2026-01-10T07:15:00Z");

    const activity = await createActivity({
      userId: user.id,
      title: "Morning run",
      kind: "exercise",
      startedAt: start,
      endedAt: end,
      // Deliberately wrong — the server must ignore it.
      durationMinutes: 999,
    });

    expect(activity.durationMinutes).toBe(75);
  });

  it("recomputes duration when the times are edited", async () => {
    const activity = await createActivity({
      userId: user.id,
      title: "Swim",
      kind: "sport",
      startedAt: new Date("2026-01-11T08:00:00Z"),
      endedAt: new Date("2026-01-11T09:00:00Z"),
    });
    expect(activity.durationMinutes).toBe(60);

    const updated = await updateActivity(user.id, activity.id, { endedAt: new Date("2026-01-11T09:30:00Z") });
    expect(updated?.durationMinutes).toBe(90);
  });

  it("leaves duration null when there is no end time", async () => {
    const activity = await createActivity({
      userId: user.id,
      title: "Still going",
      startedAt: new Date("2026-01-12T10:00:00Z"),
    });
    expect(activity.durationMinutes).toBeNull();
  });

  it("archives activities rather than deleting them", async () => {
    const activity = await createActivity({ userId: user.id, title: "Old activity", startedAt: new Date() });
    await updateActivity(user.id, activity.id, { archived: true });

    expect((await listActivities(user.id)).some((row) => row.id === activity.id)).toBe(false);
    const row = await db.select().from(activities).where(eq(activities.id, activity.id));
    expect(row).toHaveLength(1);
  });
});

/* ---------------------------------- prayer --------------------------------- */

describe("prayer tracking", () => {
  it("gives one cell per prayer and never invents a status", async () => {
    const cells = await prayerDay(user.id, today);
    expect(cells).toHaveLength(5);
    expect(cells.map((cell) => cell.prayer)).toEqual(["fajr", "dhuhr", "asr", "maghrib", "isha"]);
    expect(cells.every((cell) => cell.status === null)).toBe(true);
  });

  it("updates the same slot instead of duplicating it", async () => {
    await logPrayer({ userId: user.id, prayer: "fajr", day: today, status: "on_time" });
    await logPrayer({ userId: user.id, prayer: "fajr", day: today, status: "late" });

    const rows = await db
      .select()
      .from(prayerLogs)
      .where(eq(prayerLogs.userId, user.id));
    const fajr = rows.filter((row) => row.prayer === "fajr" && row.day === today);
    expect(fajr).toHaveLength(1);
    expect(fajr[0]?.status).toBe("late");
  });

  it("counts a streak only when all five are logged and none is missed", async () => {
    const full = shift(-1);
    for (const prayer of ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const) {
      await logPrayer({ userId: user.id, prayer, day: full, status: "on_time" });
    }
    // Yesterday has all five; today has only fajr, so the streak is exactly one day.
    const streak = await prayerStreak(user.id, today);
    expect(streak.current).toBe(1);
    expect(streak.longest).toBeGreaterThanOrEqual(1);

    const partial = shift(-2);
    for (const prayer of ["fajr", "dhuhr", "asr", "maghrib"] as const) {
      await logPrayer({ userId: user.id, prayer, day: partial, status: "on_time" });
    }
    const stillOne = await prayerStreak(user.id, today);
    expect(stillOne.current).toBe(1); // the four-prayer day must not extend it
  });

  it("a missed prayer breaks the day but is still reported honestly", async () => {
    const day = shift(-3);
    for (const prayer of ["fajr", "dhuhr", "asr", "maghrib"] as const) {
      await logPrayer({ userId: user.id, prayer, day, status: "on_time" });
    }
    await logPrayer({ userId: user.id, prayer: "isha", day, status: "missed" });

    const stats = await prayerStats(user.id, 30);
    expect(stats.missed).toBeGreaterThanOrEqual(1);
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.consistency).not.toBeNull();
    expect(stats.consistency).toBeLessThan(100);
  });

  it("deletes a log entry", async () => {
    const log = await logPrayer({ userId: user.id, prayer: "asr", day: shift(-9), status: "on_time" });
    expect(await deletePrayerLog(user.id, log.id)).toBe(true);
    expect(await deletePrayerLog(user.id, log.id)).toBe(false);
  });
});

/* -------------------------------- medication ------------------------------- */

describe("medication tracking", () => {
  it("builds today's schedule from the configured times", async () => {
    await createMedication({ userId: user.id, name: "Vitamin D", dose: "1000 IU", times: ["08:00", "20:00"] });

    const doses = await dosesDueToday(user.id, today);
    expect(doses).toHaveLength(2);
    expect(doses.map((dose) => dose.time)).toEqual(["08:00", "20:00"]);
    expect(doses.every((dose) => dose.status === "pending")).toBe(true);
  });

  it("cannot record the same dose twice", async () => {
    const [medication] = await listMedications(user.id, today);
    const scheduledAt = new Date(`${today}T08:00:00`);

    await logMedicationDose({ userId: user.id, medicationId: medication!.id, scheduledAt, status: "taken" });
    await logMedicationDose({ userId: user.id, medicationId: medication!.id, scheduledAt, status: "taken" });

    const rows = await db
      .select()
      .from(medicationLogs)
      .where(eq(medicationLogs.medicationId, medication!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("taken");
    expect(rows[0]?.takenAt).not.toBeNull();
  });

  it("hides inactive medications from today's schedule but keeps the record", async () => {
    const [medication] = await listMedications(user.id, today);
    await updateMedication(user.id, medication!.id, { active: false });

    const doses = await dosesDueToday(user.id, today);
    expect(doses).toHaveLength(0);

    const all = await listMedications(user.id, today);
    expect(all).toHaveLength(1);
    expect(all[0]?.active).toBe(false);
  });

  it("refuses to log a dose for a medication the caller does not own", async () => {
    const [medication] = await listMedications(user.id, today);
    const other = await makeUser("life-med");
    try {
      expect(
        await logMedicationDose({
          userId: other.id,
          medicationId: medication!.id,
          scheduledAt: new Date(`${today}T20:00:00`),
          status: "taken",
        }),
      ).toBeNull();
    } finally {
      await cleanupUser(other.id);
    }
  });

  it("reports adherence counts", async () => {
    const adherence = await medicationAdherence(user.id, 7);
    expect(adherence.taken).toBeGreaterThanOrEqual(1);
    expect(adherence.total).toBeGreaterThanOrEqual(1);
  });
});

/* ---------------------------------- diary ---------------------------------- */

describe("diary", () => {
  it("keeps one entry per day and updates it on re-save", async () => {
    await saveDiaryEntry({ userId: user.id, day: today, body: "First version", mood: 3 });
    await saveDiaryEntry({ userId: user.id, day: today, body: "Second version", mood: 4 });

    const entries = await listDiary(user.id);
    expect(entries.filter((entry) => entry.day === today)).toHaveLength(1);

    const entry = await getDiaryEntry(user.id, today);
    expect(entry?.body).toBe("Second version");
    expect(entry?.mood).toBe(4);
  });

  it("is closed to the AI unless explicitly opened, per entry", async () => {
    const closed = await saveDiaryEntry({ userId: user.id, day: shift(-1), body: "Private thoughts" });
    expect(closed.aiAllowed).toBe(false);

    const opened = await saveDiaryEntry({ userId: user.id, day: shift(-2), body: "Shareable", aiAllowed: true });
    expect(opened.aiAllowed).toBe(true);

    // Re-saving without the flag must withdraw access, not silently keep it.
    const revoked = await saveDiaryEntry({ userId: user.id, day: shift(-2), body: "Shareable" });
    expect(revoked.aiAllowed).toBe(false);
  });

  it("archives an entry without deleting the row", async () => {
    const entry = await saveDiaryEntry({ userId: user.id, day: shift(-3), body: "Old entry" });
    expect(await archiveDiaryEntry(user.id, entry.id)).toBe(true);

    expect((await listDiary(user.id)).some((row) => row.id === entry.id)).toBe(false);
    const row = await db.select().from(diaryEntries).where(eq(diaryEntries.id, entry.id));
    expect(row).toHaveLength(1);
  });
});

/* ---------------------------------- photos --------------------------------- */

describe("photos", () => {
  it("stores metadata for a referenced file", async () => {
    const photo = await addPhoto({
      userId: user.id,
      path: "/photos/2026-01-04.jpg",
      caption: "Sunrise",
      tags: ["travel"],
      location: "Dhaka",
    });

    const photos = await listPhotos(user.id);
    expect(photos.some((row) => row.id === photo.id)).toBe(true);

    const updated = await updatePhoto(user.id, photo.id, { caption: "Sunrise over the river" });
    expect(updated?.caption).toBe("Sunrise over the river");
  });

  it("archives a photo", async () => {
    const photo = await addPhoto({ userId: user.id, path: "/photos/temp.jpg" });
    await updatePhoto(user.id, photo.id, { archived: true });
    expect((await listPhotos(user.id)).some((row) => row.id === photo.id)).toBe(false);
  });
});

/* --------------------------------- timeline -------------------------------- */

describe("timeline and milestones", () => {
  it("orders timeline events newest first", async () => {
    await createTimelineEvent({ userId: user.id, title: "Older thing", occurredOn: "2025-03-01" });
    await createTimelineEvent({ userId: user.id, title: "Newer thing", occurredOn: "2026-01-15" });

    const events = await listTimeline(user.id);
    expect(events[0]?.title).toBe("Newer thing");
  });

  it("deletes timeline events and milestones outright", async () => {
    const event = await createTimelineEvent({ userId: user.id, title: "Temporary", occurredOn: today });
    expect(await deleteTimelineEvent(user.id, event.id)).toBe(true);
    expect(await deleteTimelineEvent(user.id, event.id)).toBe(false);

    const milestone = await createMilestone({ userId: user.id, title: "First deploy", achievedOn: today });
    expect((await listMilestones(user.id)).some((row) => row.id === milestone.id)).toBe(true);
    expect(await deleteMilestone(user.id, milestone.id)).toBe(true);
  });
});

/* ----------------------------- monthly reflection -------------------------- */

describe("monthly reflection", () => {
  it("keeps one reflection per month and answers all seven questions", async () => {
    const periodStart = "2026-01-01";
    await saveReflection({ userId: user.id, periodStart, learned: "About consensus", accomplished: "Shipped v1" });
    await saveReflection({ userId: user.id, periodStart, learned: "About consensus and leases" });

    const reflections = await listReflections(user.id);
    expect(reflections.filter((row) => row.periodStart === periodStart)).toHaveLength(1);

    const row = reflections.find((item) => item.periodStart === periodStart);
    expect(row?.learned).toBe("About consensus and leases");
    // A field not re-sent keeps its previous value rather than being wiped.
    expect(row?.accomplished).toBe("Shipped v1");
    expect(REFLECTION_FIELDS).toHaveLength(7);
  });
});

/* --------------------------------- summary --------------------------------- */

describe("life summary", () => {
  it("counts each module from the real tables", async () => {
    const summary = await lifeSummary(user.id, today);

    expect(summary.prayersLoggedToday).toBeGreaterThan(0);
    expect(summary.diaryEntries).toBeGreaterThan(0);
    expect(summary.photos).toBeGreaterThan(0);
    expect(summary.totalMedications).toBe(1);
    expect(summary.activeMedications).toBe(0); // paused earlier in this file
  });
});
