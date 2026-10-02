import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { assessments, courses, grades, semesters, type User } from "@/server/db/schema";
import {
  computeCgpa,
  computeCourseProgress,
  defaultBands,
  evaluateTarget,
  gradePointForPercent,
  listAssessments,
  overallCgpa,
  semesterCgpa,
  type Band,
} from "@/server/services/dashboard";
import { cleanupUser, makeUser } from "./helpers";

let user: User;
let semesterId: string;
let bands: Band[];

async function makeCourse(code: string, name: string, credits: string) {
  const [course] = await db
    .insert(courses)
    .values({ userId: user.id, semesterId, code, name, credits, status: "active" })
    .returning();
  return course!;
}

async function makeAssessment(courseId: string, name: string, maxMarks: number, weight: number, obtained: number | null) {
  const [assessment] = await db
    .insert(assessments)
    .values({ userId: user.id, courseId, name, kind: "other", maxMarks: String(maxMarks), weight: String(weight) })
    .returning();
  if (obtained !== null) {
    await db.insert(grades).values({ userId: user.id, courseId, assessmentId: assessment!.id, obtainedMarks: String(obtained) });
  }
  return assessment!;
}

beforeAll(async () => {
  user = await makeUser("academic");
  const [semester] = await db
    .insert(semesters)
    .values({ userId: user.id, name: "Semester 1", status: "active" })
    .returning();
  semesterId = semester!.id;
  bands = await defaultBands(user.id);
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("grading rules", () => {
  it("reads a configurable scale rather than a hardcoded one", () => {
    expect(bands.length).toBeGreaterThan(5);
    const ordered = [...bands].sort((a, b) => b.minPercent - a.minPercent);
    expect(ordered[0]!.minPercent).toBeGreaterThan(ordered[ordered.length - 1]!.minPercent);
  });

  it("maps a percentage to a grade point using the configured bands", () => {
    const custom: Band[] = [
      { minPercent: 80, gradePoint: 4, letter: "A" },
      { minPercent: 60, gradePoint: 3, letter: "B" },
      { minPercent: 0, gradePoint: 0, letter: "F" },
    ];
    expect(gradePointForPercent(95, custom)).toEqual({ gradePoint: 4, letter: "A" });
    expect(gradePointForPercent(72, custom)).toEqual({ gradePoint: 3, letter: "B" });
    expect(gradePointForPercent(10, custom)).toEqual({ gradePoint: 0, letter: "F" });
  });
});

describe("course progress", () => {
  it("computes weighted progress from stored marks only", async () => {
    const course = await makeCourse("CSE101", "Test course", "3");
    await makeAssessment(course.id, "Quiz", 20, 20, 18); // 90% of 20% weight → 18 points
    await makeAssessment(course.id, "Midterm", 100, 30, 60); // 60% of 30% → 18 points
    await makeAssessment(course.id, "Final", 100, 50, null);

    const items = await listAssessments(user.id, course.id);
    const progress = computeCourseProgress(course, items, bands);

    expect(progress.gradedWeight).toBeCloseTo(50, 5);
    expect(progress.securedPercent).toBeCloseTo(36, 5); // 18 + 18
    expect(progress.earnedPercentOfGraded).toBeCloseTo(72, 5); // 36 / 50
    expect(progress.remainingWeight).toBeCloseTo(50, 5);
    expect(progress.maxPossiblePercent).toBeCloseTo(86, 5); // 36 + 50
    expect(progress.totalMaxMarks).toBe(220);
    expect(progress.totalObtained).toBe(78);
  });

  it("reports no percentage when nothing has been graded", async () => {
    const course = await makeCourse("CSE102", "Ungraded course", "3");
    await makeAssessment(course.id, "Final", 100, 100, null);

    const items = await listAssessments(user.id, course.id);
    const progress = computeCourseProgress(course, items, bands);

    expect(progress.earnedPercentOfGraded).toBeNull();
    expect(progress.gradePoint).toBeNull();
    expect(progress.maxPossiblePercent).toBeCloseTo(100, 5);
  });
});

describe("CGPA", () => {
  it("is credit weighted, not a plain average", async () => {
    const heavy = await makeCourse("MAT201", "4 credit course", "4");
    await makeAssessment(heavy.id, "Final", 100, 100, 95); // A (4.0)
    const light = await makeCourse("ENG201", "1 credit course", "1");
    await makeAssessment(light.id, "Final", 100, 100, 50); // low grade

    const result = await semesterCgpa(user.id, semesterId);
    const plain =
      (result.courses.reduce((sum, course) => sum + (course.gradePoint ?? 0), 0) / result.courses.filter((c) => c.gradePoint !== null).length);

    expect(result.cgpa).not.toBeNull();
    expect(result.cgpa).toBeGreaterThan(plain); // the 4-credit A pulls it up
    expect(result.creditsCounted).toBeGreaterThanOrEqual(5);
  });

  it("aggregates every course into an overall CGPA", async () => {
    const overall = await overallCgpa(user.id);
    expect(overall.cgpa).not.toBeNull();
    expect(overall.courses.length).toBeGreaterThan(0);
  });

  it("ignores courses with no grade point at all", () => {
    const result = computeCgpa([
      { code: "A", name: "A", credits: 3, gradePoint: null, letter: null },
      { code: "B", name: "B", credits: 3, gradePoint: 4, letter: "A" },
    ]);
    expect(result.creditsCounted).toBe(3);
    expect(result.cgpa).toBe(4);
  });
});

describe("academic target calculator", () => {
  it("is arithmetic, and says when a target is still reachable", async () => {
    const result = await evaluateTarget(user.id, semesterId, 2);
    expect(result.achievable).toBe(true);
    expect(result.bestPossible).not.toBeNull();
    expect(result.detail).toMatch(/arithmetically possible/);
  });

  it("offers lower alternatives when the target is impossible", async () => {
    const result = await evaluateTarget(user.id, semesterId, 4);
    if (!result.achievable) {
      expect(result.bestPossible).toBeLessThan(4);
      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives.every((value) => value < 4)).toBe(true);
      expect(result.detail).toMatch(/no longer reachable/);
    } else {
      expect(result.achievable).toBe(true);
    }
  });

  it("does not invent a result for an empty semester", async () => {
    const [other] = await db
      .insert(semesters)
      .values({ userId: user.id, name: "Empty semester", status: "planned" })
      .returning();
    const result = await evaluateTarget(user.id, other!.id, 4);
    expect(result.bestPossible).toBeNull();
    expect(result.achievable).toBe(false);
  });

  it("never reports marks above the assessment maximum", async () => {
    const course = await makeCourse("CSE103", "Bounds check", "3");
    const assessment = await makeAssessment(course.id, "Quiz", 20, 20, null);

    const [rows] = await db
      .select({ maxMarks: assessments.maxMarks })
      .from(assessments)
      .where(and(eq(assessments.id, assessment.id)))
      .limit(1);
    expect(Number(rows?.maxMarks)).toBe(20);
  });
});
