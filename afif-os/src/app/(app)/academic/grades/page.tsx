import { and, asc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { GradesClient } from "@/components/academic/GradesClient";
import { db } from "@/server/db";
import { courses, semesters } from "@/server/db/schema";
import { getCourseProgress } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

export default async function GradesPage() {
  const user = await requireUser();

  const [allSemesters, allCourses] = await Promise.all([
    db
      .select({ id: semesters.id, name: semesters.name, status: semesters.status })
      .from(semesters)
      .where(and(eq(semesters.userId, user.id), isNull(semesters.archivedAt)))
      .orderBy(asc(semesters.startDate), asc(semesters.name)),
    db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.userId, user.id), isNull(courses.archivedAt)))
      .orderBy(asc(courses.code)),
  ]);

  const progresses = [];
  for (const course of allCourses) {
    const progress = await getCourseProgress(user.id, course.id);
    if (progress) {
      progresses.push({
        courseId: progress.courseId,
        code: progress.code,
        name: progress.name,
        credits: progress.credits,
        gradedWeight: Math.round(progress.gradedWeight * 10) / 10,
        earnedPercentOfGraded:
          progress.earnedPercentOfGraded === null ? null : Math.round(progress.earnedPercentOfGraded * 10) / 10,
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
      });
    }
  }

  const active = allSemesters.find((semester) => semester.status === "active") ?? allSemesters[0] ?? null;

  return (
    <GradesClient
      courses={progresses}
      semesters={allSemesters.map((semester) => ({ id: semester.id, name: semester.name }))}
      activeSemesterId={active?.id ?? null}
    />
  );
}
