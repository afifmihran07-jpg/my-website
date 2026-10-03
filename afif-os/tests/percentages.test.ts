import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/server/db";
import { assessments, courses, grades, semesters, studySessions, type User } from "@/server/db/schema";
import { barPercent } from "@/lib/format";
import { computeCourseProgress, defaultBands } from "@/server/services/dashboard";
import { studyDistribution, studyTotals } from "@/server/services/analytics";
import { createBook, getBook, logReading } from "@/server/services/books";
import { createProject, getProject } from "@/server/services/projects";
import { createTask, setTaskStatus } from "@/server/services/tasks";
import { prayerStats } from "@/server/services/life";
import { cleanupUser, makeUser, TEST_TZ } from "./helpers";

let user: User;

beforeAll(async () => {
  user = await makeUser("percent");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

/**
 * Regression guard for absurd percentage values.
 *
 * Found by inspecting rendered markup: chart bars carried
 * `height:42.10526315789473%`, and more seriously the course-progress bar
 * divided by zero and emitted `width:NaN%`, which makes the bar vanish.
 */
describe("barPercent never produces an absurd value", () => {
  it("returns 0 rather than Infinity or NaN when the denominator is zero", () => {
    expect(barPercent(0, 0)).toBe(0);
    expect(barPercent(50, 0)).toBe(0);
    expect(Number.isFinite(barPercent(50, 0))).toBe(true);
  });

  it("clamps to the 0-100 range", () => {
    expect(barPercent(500, 100)).toBe(100);
    expect(barPercent(-40, 100)).toBe(0);
    expect(barPercent(1_000_000, 1)).toBe(100);
  });

  it("rejects non-finite inputs", () => {
    expect(barPercent(Number.NaN, 100)).toBe(0);
    expect(barPercent(50, Number.NaN)).toBe(0);
    expect(barPercent(Number.POSITIVE_INFINITY, 100)).toBe(0);
    expect(barPercent(50, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("rounds instead of emitting fourteen decimal places", () => {
    const pct = barPercent(4000, 9500);
    expect(String(pct)).not.toMatch(/\.\d{3,}/);
    expect(pct).toBe(42.1);
    expect(barPercent(1, 3, 0)).toBe(33);
  });

  it("computes an ordinary share correctly", () => {
    expect(barPercent(1800, 3600)).toBe(50);
    expect(barPercent(3600, 3600)).toBe(100);
  });
});

describe("the course-progress bar cannot divide by zero", () => {
  it("stays finite when everything is graded at zero marks", async () => {
    const [semester] = await db
      .insert(semesters)
      .values({ userId: user.id, name: "Percent semester", status: "active" })
      .returning();
    const [course] = await db
      .insert(courses)
      .values({ userId: user.id, semesterId: semester!.id, code: "PCT101", name: "Percent course", credits: "3" })
      .returning();
    const [assessment] = await db
      .insert(assessments)
      .values({ userId: user.id, courseId: course!.id, name: "Final", kind: "final", maxMarks: "100", weight: "100" })
      .returning();
    await db.insert(grades).values({
      userId: user.id,
      courseId: course!.id,
      assessmentId: assessment!.id,
      obtainedMarks: "0",
    });

    const bands = await defaultBands(user.id);
    const progress = computeCourseProgress(course!, [{ ...assessment!, obtainedMarks: 0 }], bands);

    expect(progress.totalMaxMarks).toBe(100);
    // Every assessment is graded and the score is zero, so the ceiling is 0 —
    // this is the state that used to produce `width:NaN%`.
    expect(progress.maxPossiblePercent).toBe(0);

    const barValue = barPercent(progress.securedPercent, progress.maxPossiblePercent, 4);
    expect(Number.isFinite(barValue)).toBe(true);
    expect(barValue).toBe(0);
  });

});

describe("service percentages are bounded or null", () => {
  it("gives null, not 0%, when there is nothing to divide", async () => {
    const stats = await prayerStats(user.id, 30);
    expect(stats.total).toBe(0);
    expect(stats.consistency).toBeNull();
  });

  it("gives a null change when the previous window was empty", async () => {
    const totals = await studyTotals(user.id, 7, TEST_TZ);
    expect(totals.seconds).toBe(0);
    expect(totals.changePercent).toBeNull();
    expect(totals.consistency).toBe(0);
    expect(totals.averagePerStudiedDay).toBe(0);
  });

  it("gives 0% slices when nothing is linked, never NaN", async () => {
    const distribution = await studyDistribution(user.id, 7);
    for (const slice of [...distribution.byCourse, ...distribution.byBook, ...distribution.byProject]) {
      expect(Number.isFinite(slice.percent)).toBe(true);
      expect(slice.percent).toBeGreaterThanOrEqual(0);
      expect(slice.percent).toBeLessThanOrEqual(100);
    }
  });

  it("stays within 0-100 once real study data exists", async () => {
    const now = Date.now();
    await db.insert(studySessions).values({
      userId: user.id,
      title: "Percent session",
      status: "completed",
      startedAt: new Date(now - 3600_000),
      endedAt: new Date(),
      durationSeconds: 3600,
      accumulatedSeconds: 3600,
    });

    const totals = await studyTotals(user.id, 7, TEST_TZ);
    expect(totals.consistency).toBeGreaterThanOrEqual(0);
    expect(totals.consistency).toBeLessThanOrEqual(100);
    expect(totals.changePercent).toBeNull(); // no data in the previous window

    const distribution = await studyDistribution(user.id, 7);
    for (const slice of [...distribution.byCourse, ...distribution.byBook, ...distribution.byProject]) {
      expect(slice.percent).toBeGreaterThanOrEqual(0);
      expect(slice.percent).toBeLessThanOrEqual(100);
    }
  });
});

describe("book and project derived percentages", () => {
  it("clamps book progress at 100 and returns null without a page total", async () => {
    const book = await createBook({ userId: user.id, title: "Percent book", totalPages: 100 });

    // The service refuses a page beyond the book's length, so progress can
    // never exceed 100% by logging more pages than exist.
    await expect(
      logReading({ userId: user.id, bookId: book.id, pagesTo: 250, durationMinutes: 30 }),
    ).rejects.toThrow(/you cannot be on page 250/);

    await logReading({ userId: user.id, bookId: book.id, pagesTo: 100, durationMinutes: 30 });
    const reloaded = await getBook(user.id, book.id);
    expect(reloaded?.progressPercent).toBe(100);
    expect(reloaded!.progressPercent!).toBeLessThanOrEqual(100);
    expect(reloaded!.progressPercent!).toBeGreaterThanOrEqual(0);

    const noTotal = await createBook({ userId: user.id, title: "No page total", totalPages: null });
    const reloadedNoTotal = await getBook(user.id, noTotal.id);
    expect(reloadedNoTotal?.progressPercent).toBeNull();
  });

  it("reports null task completion when a project has no tasks", async () => {
    const project = await createProject({ userId: user.id, name: "Empty project", status: "active" });
    const empty = await getProject(user.id, project.id);
    expect(empty?.taskCompletion).toBeNull();

    const task = await createTask({ userId: user.id, title: "Only task", projectId: project.id });
    await setTaskStatus(user.id, task.id, "completed");

    const withTask = await getProject(user.id, project.id);
    expect(withTask?.taskCompletion).toBe(100);
    expect(withTask!.taskCompletion!).toBeGreaterThanOrEqual(0);
    expect(withTask!.taskCompletion!).toBeLessThanOrEqual(100);
  });
});
