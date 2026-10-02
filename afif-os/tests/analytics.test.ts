import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, gte } from "drizzle-orm";

import { db } from "@/server/db";
import { courses, readingSessions, semesters, studySessions, tasks, type User } from "@/server/db/schema";
import {
  academicTimeSplit,
  achievementAnalytics,
  learningAnalytics,
  opportunityAnalytics,
  projectAnalytics,
  readingAnalytics,
  studyByHour,
  studyByWeekday,
  studyDistribution,
  studyTotals,
  studyTrend,
  taskAnalytics,
} from "@/server/services/analytics";
import { createAchievement } from "@/server/services/achievements";
import { createBook, logReading } from "@/server/services/books";
import { addSkillEvidence, createConcept, createDomain, createNote, createQuestion, createSkill } from "@/server/services/learning";
import { createOpportunity, updateOpportunity } from "@/server/services/opportunities";
import { createProject } from "@/server/services/projects";
import { createTask } from "@/server/services/tasks";
import { cleanupUser, makeUser, TEST_TZ } from "./helpers";

let user: User;
let course: { id: string };
let project: { id: string };
let book: { id: string };

/** Insert a completed study session directly so the timestamps are exact. */
async function seedStudy(seconds: number, startedAt: Date, links: { courseId?: string; projectId?: string; bookId?: string } = {}) {
  const [row] = await db
    .insert(studySessions)
    .values({
      userId: user.id,
      title: "Seeded session",
      status: "completed",
      startedAt,
      endedAt: new Date(startedAt.getTime() + seconds * 1000),
      durationSeconds: seconds,
      accumulatedSeconds: seconds,
      courseId: links.courseId ?? null,
      projectId: links.projectId ?? null,
      bookId: links.bookId ?? null,
    })
    .returning();
  return row!;
}

beforeAll(async () => {
  user = await makeUser("analytics");

  const [semester] = await db
    .insert(semesters)
    .values({ userId: user.id, name: "Semester 1", status: "active" })
    .returning();
  const [courseRow] = await db
    .insert(courses)
    .values({ userId: user.id, semesterId: semester!.id, code: "CSE111", name: "Programming Language I", credits: "3" })
    .returning();
  course = { id: courseRow!.id };

  const created = await createProject({ userId: user.id, name: "Analytics project", status: "active" });
  project = { id: created.id };

  const createdBook = await createBook({ userId: user.id, title: "Analytics book", totalPages: 400 });
  book = { id: createdBook.id };

  const now = Date.now();
  // Three sessions inside the 7-day window, one outside it, one discarded.
  await seedStudy(3600, new Date(now - 1 * 86_400_000), { courseId: course.id });
  await seedStudy(1800, new Date(now - 2 * 86_400_000), { projectId: project.id });
  await seedStudy(900, new Date(now - 3 * 86_400_000), { bookId: book.id });
  await seedStudy(7200, new Date(now - 40 * 86_400_000), { courseId: course.id });
  await db.insert(studySessions).values({
    userId: user.id,
    title: "Discarded",
    status: "discarded",
    startedAt: new Date(now - 1 * 86_400_000),
    durationSeconds: 5400,
    accumulatedSeconds: 5400,
  });

  const task1 = await createTask({ userId: user.id, title: "Finished task", projectId: project.id });
  const { setTaskStatus } = await import("@/server/services/tasks");
  await setTaskStatus(user.id, task1.id, "completed");
  await createTask({ userId: user.id, title: "Open task", projectId: project.id });

  await logReading({ userId: user.id, bookId: book.id, pagesTo: 80, durationMinutes: 60 });
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("study analytics", () => {
  it("sums only completed sessions inside the window", async () => {
    const totals = await studyTotals(user.id, 7, TEST_TZ);

    expect(totals.seconds).toBe(3600 + 1800 + 900);
    expect(totals.sessions).toBe(3);
    expect(totals.longestSessionSeconds).toBe(3600);
    expect(totals.daysStudied).toBe(3);
    // 3 studied days out of a 7-day window — a real ratio, not a grade.
    expect(totals.consistency).toBe(Math.round((3 / 7) * 100));
    expect(totals.averagePerStudiedDay).toBe(Math.round(6300 / 3));
  });

  it("returns one point per day in the range, zeros included", async () => {
    const trend = await studyTrend(user.id, 7, TEST_TZ);

    expect(trend).toHaveLength(7);
    expect(trend.every((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.dayKey))).toBe(true);
    expect(trend.reduce((sum, point) => sum + point.seconds, 0)).toBe(6300);
    expect(trend.filter((point) => point.seconds === 0).length).toBe(4);
  });

  it("compares against the preceding window of the same length", async () => {
    const totals = await studyTotals(user.id, 30, TEST_TZ);
    expect(totals.seconds).toBe(6300);
    expect(totals.previousSeconds).toBe(7200);
    expect(totals.changePercent).toBe(Math.round(((6300 - 7200) / 7200) * 100));
  });

  it("splits study by what it was attached to", async () => {
    const distribution = await studyDistribution(user.id, 7);

    expect(distribution.byCourse).toHaveLength(1);
    expect(distribution.byCourse[0]?.label).toBe("Programming Language I");
    expect(distribution.byCourse[0]?.seconds).toBe(3600);
    expect(distribution.byProject[0]?.seconds).toBe(1800);
    expect(distribution.byBook[0]?.seconds).toBe(900);
    expect(distribution.unlinkedSeconds).toBe(0);

    const unlinked = await seedStudy(600, new Date());
    const after = await studyDistribution(user.id, 7);
    expect(after.unlinkedSeconds).toBe(600);
    await db.delete(studySessions).where(eq(studySessions.id, unlinked.id));
  });

  it("distributes by hour and weekday with every bucket present", async () => {
    const byHour = await studyByHour(user.id, 7, TEST_TZ);
    expect(byHour).toHaveLength(24);
    expect(byHour.reduce((sum, row) => sum + row.seconds, 0)).toBe(6300);

    const byWeekday = await studyByWeekday(user.id, 7, TEST_TZ);
    expect(byWeekday).toHaveLength(7);
    expect(byWeekday.map((row) => row.label)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(byWeekday.reduce((sum, row) => sum + row.seconds, 0)).toBe(6300);
  });

  it("never merges class time into self-study", async () => {
    const split = await academicTimeSplit(user.id, 7);

    expect(split.selfStudySeconds).toBe(6300);
    // No timetable rows exist for this user, so class time is genuinely zero.
    expect(split.classSeconds).toBe(0);
    expect(split.weeklyClassSeconds).toBe(0);
    expect(split.weeks).toBe(1);
  });
});

describe("task analytics", () => {
  it("counts open, completed and overdue from the real table", async () => {
    const stats = await taskAnalytics(user.id, 7, TEST_TZ);

    const raw = await db.select().from(tasks).where(eq(tasks.userId, user.id));
    expect(stats.completed).toBe(raw.filter((row) => row.status === "completed").length);
    expect(stats.open).toBe(raw.filter((row) => row.status === "todo" || row.status === "in_progress").length);
    expect(stats.completedInRange).toBeGreaterThanOrEqual(1);
    expect(stats.overdue).toBe(0);
  });
});

describe("reading analytics", () => {
  it("reconciles page counts with the reading_sessions table", async () => {
    const stats = await readingAnalytics(user.id, 7, TEST_TZ);

    const raw = await db
      .select({ pages: readingSessions.pagesRead })
      .from(readingSessions)
      .where(and(eq(readingSessions.userId, user.id), gte(readingSessions.startedAt, new Date(Date.now() - 7 * 86_400_000))));

    expect(stats.pages).toBe(raw.reduce((sum, row) => sum + row.pages, 0));
    expect(stats.pages).toBe(80);
    expect(stats.byBook[0]?.label).toBe("Analytics book");
    expect(stats.booksReading).toBe(1);
  });
});

describe("learning analytics", () => {
  it("counts concepts, notes, questions and evidence", async () => {
    const domain = await createDomain({ userId: user.id, name: "Analytics domain" });
    await createConcept({ userId: user.id, title: "Window functions", domainId: domain.id });
    await createNote({ userId: user.id, title: "Window function notes", domainId: domain.id });
    const question = await createQuestion({ userId: user.id, question: "Why are window functions slow?" });
    const skill = await createSkill({ userId: user.id, name: "SQL", domainId: domain.id });
    await addSkillEvidence({ userId: user.id, skillId: skill.id, title: "Solved 40 problems" });

    const stats = await learningAnalytics(user.id, 7);
    expect(stats.concepts).toBeGreaterThanOrEqual(1);
    expect(stats.notes).toBeGreaterThanOrEqual(1);
    expect(stats.openQuestions).toBeGreaterThanOrEqual(1);
    expect(stats.evidence).toBeGreaterThanOrEqual(1);
    expect(stats.evidenceInRange).toBeGreaterThanOrEqual(1);

    const { updateQuestion } = await import("@/server/services/learning");
    await updateQuestion(user.id, question.id, { answer: "Because of the sort.", status: "answered" });
    const after = await learningAnalytics(user.id, 7);
    expect(after.answeredQuestions).toBeGreaterThanOrEqual(1);
  });
});

describe("opportunity analytics", () => {
  it("only reports a success rate once decisions exist", async () => {
    const first = await opportunityAnalytics(user.id);
    expect(first.successRate).toBeNull();

    const applied = await createOpportunity({ userId: user.id, name: "Applied to" });
    await updateOpportunity(user.id, applied.id, { status: "accepted" });
    const rejected = await createOpportunity({ userId: user.id, name: "Rejected from" });
    await updateOpportunity(user.id, rejected.id, { status: "rejected" });

    const second = await opportunityAnalytics(user.id);
    expect(second.accepted).toBe(1);
    expect(second.rejected).toBe(1);
    expect(second.successRate).toBe(50);
  });
});

describe("project analytics", () => {
  it("attributes study time and task completion per project", async () => {
    const rows = await projectAnalytics(user.id, 7);
    const row = rows.find((item) => item.id === project.id);

    expect(row?.studySeconds).toBe(1800);
    expect(row?.studyInRange).toBe(1800);
    expect(row?.tasksTotal).toBe(2);
    expect(row?.tasksDone).toBe(1);
  });
});

describe("achievement analytics", () => {
  it("groups achievements by the year they actually happened", async () => {
    await createAchievement({ userId: user.id, title: "Old award", occurredOn: "2024-05-01" });
    await createAchievement({ userId: user.id, title: "New award", occurredOn: "2026-01-20" });

    const stats = await achievementAnalytics(user.id);
    const years = stats.byYear.map((row) => row.year);
    expect(years).toEqual(["2024", "2026"]);
    expect(stats.byYear.find((row) => row.year === "2026")?.count).toBe(1);
  });
});
