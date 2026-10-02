"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { assessments, courses, grades, semesters } from "@/server/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import {
  evaluateTarget,
  getCourseProgress,
  type Feasibility,
  type CourseProgress,
} from "@/server/services/dashboard";

const semesterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["planned", "active", "completed"]).default("active"),
});

const courseSchema = z.object({
  semesterId: z.string().uuid(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  credits: z.coerce.number().min(0).max(20).default(3),
  faculty: z.string().trim().max(80).nullable().optional(),
  section: z.string().trim().max(20).nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
});

const assessmentSchema = z.object({
  courseId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["quiz", "assignment", "midterm", "final", "presentation", "lab", "other"]).default("other"),
  maxMarks: z.coerce.number().positive().max(1000),
  weight: z.coerce.number().min(0).max(100),
  scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const gradeSchema = z.object({
  assessmentId: z.string().uuid(),
  obtainedMarks: z.coerce.number().min(0).max(1000),
});

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate() {
  revalidatePath("/academic");
  revalidatePath("/dashboard");
}

function serialiseProgress(progress: CourseProgress) {
  return {
    courseId: progress.courseId,
    code: progress.code,
    name: progress.name,
    credits: progress.credits,
    gradedWeight: Math.round(progress.gradedWeight * 10) / 10,
    earnedPercentOfGraded: progress.earnedPercentOfGraded === null ? null : Math.round(progress.earnedPercentOfGraded * 10) / 10,
    securedPercent: Math.round(progress.securedPercent * 10) / 10,
    maxPossiblePercent: Math.round(progress.maxPossiblePercent * 10) / 10,
    remainingWeight: Math.round(progress.remainingWeight * 10) / 10,
    totalMaxMarks: progress.totalMaxMarks,
    totalObtained: progress.totalObtained,
    gradePoint: progress.gradePoint,
    letter: progress.letter,
    assessments: progress.assessments.map((item) => ({
      id: item.id,
      name: item.name,
      kind: item.kind,
      maxMarks: Number(item.maxMarks),
      weight: Number(item.weight),
      obtainedMarks: item.obtainedMarks,
      scheduledFor: item.scheduledFor,
    })),
  };
}

export type SerializedCourseProgress = ReturnType<typeof serialiseProgress>;

export async function createSemesterAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  return safeAction("semester:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const parsed = semesterSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid semester");

    const [row] = await db
      .insert(semesters)
      .values({
        userId,
        name: parsed.data.name,
        startDate: parsed.data.startDate ?? null,
        endDate: parsed.data.endDate ?? null,
        status: parsed.data.status,
      })
      .returning();
    revalidate();
    return ok({ id: row!.id, name: row!.name });
  });
}

export async function createCourseAction(input: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  return safeAction("course:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const parsed = courseSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid course");

    const [semester] = await db
      .select({ id: semesters.id })
      .from(semesters)
      .where(and(eq(semesters.id, parsed.data.semesterId), eq(semesters.userId, userId)))
      .limit(1);
    if (!semester) return fail("That semester does not belong to your account.");

    const [duplicate] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.userId, userId), eq(courses.semesterId, semester.id), eq(courses.code, parsed.data.code)))
      .limit(1);
    if (duplicate) return fail(`${parsed.data.code} already exists in this semester.`);

    const [row] = await db
      .insert(courses)
      .values({
        userId,
        semesterId: semester.id,
        code: parsed.data.code.toUpperCase(),
        name: parsed.data.name,
        credits: String(parsed.data.credits),
        faculty: parsed.data.faculty ?? null,
        section: parsed.data.section ?? null,
        color: parsed.data.color ?? "#6366f1",
      })
      .returning();
    revalidate();
    return ok({ id: row!.id, code: row!.code });
  });
}

export async function createAssessmentAction(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  return safeAction("assessment:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const parsed = assessmentSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid assessment");

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, parsed.data.courseId), eq(courses.userId, userId)))
      .limit(1);
    if (!course) return fail("That course does not belong to your account.");

    const [row] = await db
      .insert(assessments)
      .values({
        userId,
        courseId: course.id,
        name: parsed.data.name,
        kind: parsed.data.kind,
        maxMarks: String(parsed.data.maxMarks),
        weight: String(parsed.data.weight),
        scheduledFor: parsed.data.scheduledFor ?? null,
      })
      .returning();
    revalidate();
    return ok({ id: row!.id, name: row!.name });
  });
}

/**
 * Recording a mark is transactional and re-validated server-side: obtained
 * marks are checked against the assessment maximum before they are stored.
 */
export async function recordGradeAction(
  input: unknown,
): Promise<ActionResult<{ assessmentId: string; obtainedMarks: number }>> {
  return safeAction("grade:record", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const parsed = gradeSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid grade");

    const [assessment] = await db
      .select()
      .from(assessments)
      .where(and(eq(assessments.id, parsed.data.assessmentId), eq(assessments.userId, userId)))
      .limit(1);
    if (!assessment) return fail("That assessment does not belong to your account.");
    if (parsed.data.obtainedMarks > Number(assessment.maxMarks)) {
      return fail(`Marks cannot exceed the maximum of ${assessment.maxMarks}.`);
    }

    await db.transaction(async (tx) => {
      await tx
        .insert(grades)
        .values({
          userId,
          courseId: assessment.courseId,
          assessmentId: assessment.id,
          obtainedMarks: String(parsed.data.obtainedMarks),
        })
        .onConflictDoUpdate({
          target: grades.assessmentId,
          set: { obtainedMarks: String(parsed.data.obtainedMarks), gradedAt: new Date() },
        });
    });

    revalidate();
    return ok({ assessmentId: assessment.id, obtainedMarks: parsed.data.obtainedMarks });
  });
}

export async function courseProgressAction(courseId: string): Promise<ActionResult<SerializedCourseProgress>> {
  return safeAction("course:progress", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const progress = await getCourseProgress(userId, courseId);
    if (!progress) return fail("Course not found.");
    return ok(serialiseProgress(progress));
  });
}

export async function evaluateTargetAction(
  semesterId: string,
  target: number,
): Promise<ActionResult<Feasibility>> {
  return safeAction("target:evaluate", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    if (!Number.isFinite(target) || target < 0 || target > 5) return fail("Target must be between 0 and 5.");
    return ok(await evaluateTarget(userId, semesterId, target));
  });
}
