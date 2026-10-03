import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { classSchedules, courses, semesters, studySessions, type User } from "@/server/db/schema";
import {
  StudyError,
  discardStudy,
  elapsedSeconds,
  getDaySummary,
  getRunningStudy,
  getTimeline,
  pauseStudy,
  resumeStudy,
  startStudy,
  stopStudy,
  universitySecondsForDay,
} from "@/server/services/study";
import { toLocalDayKey } from "@/server/lib/time";
import { TEST_TZ, cleanupUser, makeUser, uniqueKey } from "./helpers";

let user: User;
let courseId: string;

beforeAll(async () => {
  user = await makeUser("study");
  const [semester] = await db.insert(semesters).values({ userId: user.id, name: "S1", status: "active" }).returning();
  const [course] = await db
    .insert(courses)
    .values({ userId: user.id, semesterId: semester!.id, code: "CSE111", name: "Programming I", credits: "3" })
    .returning();
  courseId = course!.id;
});

afterAll(async () => {
  await cleanupUser(user.id);
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("study timer lifecycle", () => {
  it("starts a session that is immediately readable (survives a refresh)", async () => {
    const clientKey = uniqueKey("start");
    const session = await startStudy({ userId: user.id, title: "CSE111 — Recursion", courseId, clientKey });

    expect(session.status).toBe("active");
    expect(session.runningSince).not.toBeNull();
    expect(session.durationSeconds).toBe(0);

    // A page refresh re-reads from the database rather than from browser state.
    const reloaded = await getRunningStudy(user.id);
    expect(reloaded?.id).toBe(session.id);
    expect(reloaded?.title).toBe("CSE111 — Recursion");
  });

  it("refuses to start a second session while one is running", async () => {
    await expect(startStudy({ userId: user.id, title: "Another topic", clientKey: uniqueKey("dup") })).rejects.toThrow(
      StudyError,
    );
  });

  it("treats a repeated start with the same clientKey as the same session", async () => {
    const running = await getRunningStudy(user.id);
    const clientKey = running?.clientKey ?? uniqueKey("idem");

    const again = await startStudy({ userId: user.id, title: "Different title", clientKey });
    expect(again.id).toBe(running?.id);

    const [count] = await db
      .select({ id: studySessions.id })
      .from(studySessions)
      .where(eq(studySessions.userId, user.id));
    expect(count).toBeDefined();
  });

  it("computes elapsed time server-side while running", async () => {
    const running = (await getRunningStudy(user.id))!;
    const before = elapsedSeconds(running);
    await wait(1200);
    const after = elapsedSeconds((await getRunningStudy(user.id))!);
    expect(after).toBeGreaterThan(before);
  });

  it("pauses, banks the time and stops counting", async () => {
    const paused = await pauseStudy(user.id);
    expect(paused.status).toBe("paused");
    expect(paused.runningSince).toBeNull();
    expect(paused.accumulatedSeconds).toBeGreaterThan(0);

    const first = elapsedSeconds(paused);
    await wait(1100);
    const second = elapsedSeconds((await getRunningStudy(user.id))!);
    expect(second).toBe(first);
  });

  it("cannot pause twice", async () => {
    await expect(pauseStudy(user.id)).rejects.toThrow(StudyError);
  });

  it("resumes and starts counting again", async () => {
    const resumed = await resumeStudy(user.id);
    expect(resumed.status).toBe("active");
    expect(resumed.runningSince).not.toBeNull();

    const before = elapsedSeconds(resumed);
    await wait(1100);
    const after = elapsedSeconds((await getRunningStudy(user.id))!);
    expect(after).toBeGreaterThan(before);
  });

  it("stops and saves a server-computed duration", async () => {
    const running = (await getRunningStudy(user.id))!;
    const expectedMinimum = running.accumulatedSeconds;

    const { session, alreadySaved } = await stopStudy({ userId: user.id, notes: "Covered base cases" });
    expect(alreadySaved).toBe(false);
    expect(session.status).toBe("completed");
    expect(session.endedAt).not.toBeNull();
    expect(session.durationSeconds).toBeGreaterThanOrEqual(expectedMinimum);
    expect(session.durationSeconds).toBeLessThan(expectedMinimum + 120);
    expect(session.notes).toBe("Covered base cases");

    // The stored row is the record of truth.
    const [row] = await db.select().from(studySessions).where(eq(studySessions.id, session.id)).limit(1);
    expect(row?.durationSeconds).toBe(session.durationSeconds);
    expect(await getRunningStudy(user.id)).toBeNull();
  });

  it("does not create a second session when Stop is pressed twice", async () => {
    const before = await db.select({ id: studySessions.id }).from(studySessions).where(eq(studySessions.userId, user.id));
    const { alreadySaved } = await stopStudy({ userId: user.id });
    const after = await db.select({ id: studySessions.id }).from(studySessions).where(eq(studySessions.userId, user.id));

    expect(alreadySaved).toBe(true);
    expect(after.length).toBe(before.length);
  });

  it("discards a session instead of deleting it", async () => {
    const started = await startStudy({ userId: user.id, title: "Scratch session", clientKey: uniqueKey("discard") });
    await discardStudy(user.id, "changed my mind");

    const [row] = await db.select().from(studySessions).where(eq(studySessions.id, started.id)).limit(1);
    expect(row?.status).toBe("discarded");
    expect(await getRunningStudy(user.id)).toBeNull();
  });

  it("rejects a title that is too short", async () => {
    await expect(startStudy({ userId: user.id, title: "x", clientKey: uniqueKey("short") })).rejects.toThrow(StudyError);
  });
});

describe("study history keeps university time separate", () => {
  it("counts class schedules separately from self-study", async () => {
    const dayKey = toLocalDayKey(new Date(), TEST_TZ);
    const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();

    await db.insert(classSchedules).values({
      userId: user.id,
      courseId,
      dayOfWeek: weekday,
      startTime: "08:00:00",
      endTime: "09:30:00",
      room: "UB1",
    });

    const started = await startStudy({ userId: user.id, title: "Self study", courseId, clientKey: uniqueKey("sep") });
    await wait(1100);
    await stopStudy({ userId: user.id });

    const university = await universitySecondsForDay(user.id, dayKey, TEST_TZ);
    expect(university).toBe(90 * 60);

    const summary = await getDaySummary(user.id, dayKey, TEST_TZ);
    expect(summary.totalSeconds).toBeGreaterThan(0);
    expect(summary.universitySeconds).toBe(90 * 60);
    expect(summary.totalAcademicSeconds).toBe(summary.totalSeconds + summary.universitySeconds);
    expect(summary.sessions.every((session) => session.id !== started.id)).toBe(false);

    const timeline = await getTimeline(user.id, dayKey, TEST_TZ);
    expect(timeline.length).toBeGreaterThan(0);
    const total = timeline.reduce((sum, segment) => sum + segment.seconds, 0);
    expect(total).toBeGreaterThan(0);
  });
});
