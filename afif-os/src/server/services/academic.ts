import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { assessments, courseResources, courses, grades, semesters } from "@/server/db/schema";
import { semesterCgpa } from "@/server/services/dashboard";
import type { ResourceKind } from "@/lib/labels";

/**
 * Academic management beyond the overview screen (§11).
 *
 * Semesters, courses and resources each get their own page, so this file holds
 * the read/write paths those pages need. CGPA is always computed from the
 * assessments that actually exist — never stored or estimated.
 */

/* -------------------------------- semesters -------------------------------- */

export type SemesterWithStats = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  targetCgpa: number | null;
  notes: string | null;
  courseCount: number;
  assessmentCount: number;
  cgpa: number | null;
  creditsCounted: number;
};

export async function listSemestersWithStats(userId: string): Promise<SemesterWithStats[]> {
  const rows = await db
    .select({
      id: semesters.id,
      name: semesters.name,
      startDate: semesters.startDate,
      endDate: semesters.endDate,
      status: sql<string>`${semesters.status}::text`,
      targetCgpa: semesters.targetCgpa,
      notes: semesters.notes,
      courseCount: sql<number>`(select count(*) from ${courses} where ${courses.semesterId} = ${sql.raw('"semesters"."id"')} and ${courses.archivedAt} is null)`,
      assessmentCount: sql<number>`(
        select count(*) from ${assessments}
        join ${courses} on ${sql.raw('"courses"."id"')} = ${sql.raw('"assessments"."course_id"')}
        where ${sql.raw('"courses"."semester_id"')} = ${sql.raw('"semesters"."id"')}
      )`,
    })
    .from(semesters)
    .where(and(eq(semesters.userId, userId), isNull(semesters.archivedAt)))
    .orderBy(asc(semesters.startDate), asc(semesters.name));

  const withCgpa = await Promise.all(
    rows.map(async (row) => {
      const result = await semesterCgpa(userId, row.id);
      return {
        ...row,
        targetCgpa: row.targetCgpa === null ? null : Number(row.targetCgpa),
        courseCount: Number(row.courseCount),
        assessmentCount: Number(row.assessmentCount),
        cgpa: result.cgpa,
        creditsCounted: result.creditsCounted,
      };
    }),
  );

  return withCgpa;
}

/** Exactly one semester is active at a time; the rest are demoted in the same transaction. */
export async function setActiveSemester(userId: string, semesterId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: semesters.id })
      .from(semesters)
      .where(and(eq(semesters.id, semesterId), eq(semesters.userId, userId), isNull(semesters.archivedAt)));
    if (!target) return false;

    await tx
      .update(semesters)
      .set({ status: "planned", updatedAt: new Date() })
      .where(and(eq(semesters.userId, userId), eq(semesters.status, "active")));
    await tx
      .update(semesters)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(semesters.id, semesterId));
    return true;
  });
}

export async function updateSemester(
  userId: string,
  semesterId: string,
  patch: { name?: string | null; startDate?: string | null; endDate?: string | null; status?: string | null; targetCgpa?: number | null; notes?: string | null; archived?: boolean },
) {
  const [existing] = await db
    .select({ id: semesters.id, status: semesters.status })
    .from(semesters)
    .where(and(eq(semesters.id, semesterId), eq(semesters.userId, userId), isNull(semesters.archivedAt)));
  if (!existing) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.startDate !== undefined) values.startDate = patch.startDate;
  if (patch.endDate !== undefined) values.endDate = patch.endDate;
  if (patch.status !== undefined && patch.status !== null) values.status = patch.status;
  if (patch.targetCgpa !== undefined) values.targetCgpa = patch.targetCgpa === null ? null : String(patch.targetCgpa);
  if (patch.notes !== undefined) values.notes = patch.notes;
  // Archiving the active semester must not leave the user with no active one
  // silently set — the status is cleared so the overview picks the first
  // remaining semester instead of pointing at an archived one.
  if (patch.archived) {
    values.archivedAt = new Date();
    if (existing.status === "active") values.status = "planned";
  }

  const [row] = await db.update(semesters).set(values).where(eq(semesters.id, semesterId)).returning();
  return row ?? null;
}

/* --------------------------------- courses --------------------------------- */

export type CourseWithStats = {
  id: string;
  semesterId: string;
  semesterName: string;
  code: string;
  name: string;
  credits: number;
  faculty: string | null;
  section: string | null;
  color: string | null;
  status: string;
  targetGrade: string | null;
  assessmentCount: number;
  gradedCount: number;
  totalWeight: number;
  gradedWeight: number;
};

export async function listCoursesWithStats(userId: string): Promise<CourseWithStats[]> {
  const rows = await db
    .select({
      id: courses.id,
      semesterId: courses.semesterId,
      semesterName: semesters.name,
      code: courses.code,
      name: courses.name,
      credits: courses.credits,
      faculty: courses.faculty,
      section: courses.section,
      color: courses.color,
      status: sql<string>`${courses.status}::text`,
      targetGrade: courses.targetGrade,
      assessmentCount: sql<number>`(select count(*) from ${assessments} where ${assessments.courseId} = ${sql.raw('"courses"."id"')})`,
      gradedCount: sql<number>`(select count(*) from ${assessments} join ${grades} on ${grades.assessmentId} = ${assessments.id} where ${assessments.courseId} = ${sql.raw('"courses"."id"')})`,
      totalWeight: sql<number>`coalesce((select sum(${assessments.weight}) from ${assessments} where ${assessments.courseId} = ${sql.raw('"courses"."id"')}), 0)`,
      gradedWeight: sql<number>`coalesce((select sum(${assessments.weight}) from ${assessments} join ${grades} on ${grades.assessmentId} = ${assessments.id} where ${assessments.courseId} = ${sql.raw('"courses"."id"')}), 0)`,
    })
    .from(courses)
    .innerJoin(semesters, eq(semesters.id, courses.semesterId))
    .where(and(eq(courses.userId, userId), isNull(courses.archivedAt)))
    .orderBy(asc(semesters.name), asc(courses.code));

  return rows.map((row) => ({
    ...row,
    credits: Number(row.credits),
    assessmentCount: Number(row.assessmentCount),
    gradedCount: Number(row.gradedCount),
    totalWeight: Number(row.totalWeight),
    gradedWeight: Number(row.gradedWeight),
  }));
}

export async function updateCourse(
  userId: string,
  courseId: string,
  patch: { code?: string | null; name?: string | null; credits?: number | null; faculty?: string | null; section?: string | null; color?: string | null; targetGrade?: string | null; archived?: boolean },
) {
  const [existing] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)));
  if (!existing) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of ["code", "name", "faculty", "section", "color", "targetGrade"] as const) {
    if (patch[key] !== undefined) values[key] = patch[key];
  }
  if (patch.credits !== undefined && patch.credits !== null) values.credits = String(patch.credits);
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  const [row] = await db
    .update(courses)
    .set(values)
    // the lookup above excludes archived rows, so restoring has to target the
    // row by id alone once we know the caller owns it
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .returning();
  return row ?? null;
}

/* -------------------------------- resources -------------------------------- */

export type ResourceWithCourse = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  url: string;
  kind: ResourceKind;
  notes: string | null;
  createdAt: string;
};

export async function listResources(userId: string, courseId?: string | null): Promise<ResourceWithCourse[]> {
  const conditions = [eq(courseResources.userId, userId), isNull(courses.archivedAt)];
  if (courseId) conditions.push(eq(courseResources.courseId, courseId));

  const rows = await db
    .select({
      id: courseResources.id,
      courseId: courseResources.courseId,
      courseCode: courses.code,
      courseName: courses.name,
      title: courseResources.title,
      url: courseResources.url,
      kind: sql<string>`${courseResources.kind}::text`,
      notes: courseResources.notes,
      createdAt: courseResources.createdAt,
    })
    .from(courseResources)
    .innerJoin(courses, eq(courses.id, courseResources.courseId))
    .where(and(...conditions))
    .orderBy(asc(courses.code), asc(courseResources.title));

  return rows.map((row) => ({ ...row, kind: row.kind as ResourceKind, createdAt: row.createdAt.toISOString() }));
}

export async function createResource(input: {
  userId: string;
  courseId: string;
  title: string;
  url: string;
  kind: ResourceKind;
  notes?: string | null;
}) {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, input.courseId), eq(courses.userId, input.userId), isNull(courses.archivedAt)));
  if (!course) throw new Error("Course not found");

  const [row] = await db
    .insert(courseResources)
    .values({
      userId: input.userId,
      courseId: input.courseId,
      title: input.title,
      url: input.url,
      kind: input.kind,
      notes: input.notes ?? null,
    })
    .returning();
  return row!;
}

export async function updateResource(
  userId: string,
  resourceId: string,
  patch: { title?: string | null; url?: string | null; kind?: ResourceKind | null; notes?: string | null },
) {
  const [existing] = await db
    .select({ id: courseResources.id })
    .from(courseResources)
    .where(and(eq(courseResources.id, resourceId), eq(courseResources.userId, userId)));
  if (!existing) return null;

  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title;
  if (patch.url !== undefined) values.url = patch.url;
  if (patch.kind !== undefined && patch.kind !== null) values.kind = patch.kind;
  if (patch.notes !== undefined) values.notes = patch.notes;

  const [row] = await db.update(courseResources).set(values).where(eq(courseResources.id, resourceId)).returning();
  return row ?? null;
}

/**
 * Resources are deleted outright rather than archived: the table has no
 * archived_at column, and a stale link has no history worth keeping. The
 * course itself is only ever archived, so its resources stay reachable.
 */
export async function deleteResource(userId: string, resourceId: string): Promise<boolean> {
  const deleted = await db
    .delete(courseResources)
    .where(and(eq(courseResources.id, resourceId), eq(courseResources.userId, userId)))
    .returning({ id: courseResources.id });
  return deleted.length > 0;
}

export async function resourceCountsByCourse(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ courseId: courseResources.courseId, count: sql<number>`count(*)` })
    .from(courseResources)
    .innerJoin(courses, eq(courses.id, courseResources.courseId))
    .where(and(eq(courseResources.userId, userId), isNull(courses.archivedAt)))
    .groupBy(courseResources.courseId);

  return Object.fromEntries(rows.map((row) => [row.courseId, Number(row.count)]));
}
