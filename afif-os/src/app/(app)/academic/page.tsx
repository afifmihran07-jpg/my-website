import { and, asc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { AcademicClient } from "@/components/academic/AcademicClient";
import { db } from "@/server/db";
import { courses, semesters } from "@/server/db/schema";
import { defaultBands, getCourseProgress, overallCgpa, semesterCgpa } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

export default async function AcademicPage() {
  const user = await requireUser();

  const allSemesters = await db
    .select()
    .from(semesters)
    .where(and(eq(semesters.userId, user.id), isNull(semesters.archivedAt)))
    .orderBy(asc(semesters.createdAt));

  const active = allSemesters.find((semester) => semester.status === "active") ?? allSemesters[0] ?? null;

  const [bands, overall] = await Promise.all([defaultBands(user.id), overallCgpa(user.id)]);

  const semesterCourses = active
    ? await db
        .select()
        .from(courses)
        .where(and(eq(courses.userId, user.id), eq(courses.semesterId, active.id), isNull(courses.archivedAt)))
        .orderBy(asc(courses.code))
    : [];

  const progresses = [];
  for (const course of semesterCourses) {
    const progress = await getCourseProgress(user.id, course.id, bands);
    if (progress) {
      progresses.push({
        id: course.id,
        code: course.code,
        name: course.name,
        credits: Number(course.credits),
        color: course.color,
        status: course.status,
        targetGrade: course.targetGrade,
        gradedWeight: Math.round(progress.gradedWeight * 10) / 10,
        earnedPercentOfGraded:
          progress.earnedPercentOfGraded === null ? null : Math.round(progress.earnedPercentOfGraded * 10) / 10,
        securedPercent: Math.round(progress.securedPercent * 10) / 10,
        maxPossiblePercent: Math.round(progress.maxPossiblePercent * 10) / 10,
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
      });
    }
  }

  const activeCgpa = active ? await semesterCgpa(user.id, active.id) : null;

  return (
    <AcademicClient
      semesters={allSemesters.map((semester) => ({
        id: semester.id,
        name: semester.name,
        status: semester.status,
      }))}
      activeSemester={active ? { id: active.id, name: active.name, status: active.status } : null}
      courses={progresses}
      semesterCgpa={activeCgpa?.cgpa ?? null}
      semesterCredits={activeCgpa?.creditsCounted ?? 0}
      overallCgpa={overall.cgpa}
      overallCredits={overall.creditsCounted}
    />
  );
}
