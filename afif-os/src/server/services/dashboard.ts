import "server-only";
import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  assessments,
  books,
  calendarEvents,
  classSchedules,
  courses,
  grades,
  gradingRules,
  opportunities,
  prayerLogs,
  projects,
  semesters,
  tasks,
  type Assessment,
  type Course,
} from "@/server/db/schema";
import { toLocalDayKey, shiftDayKey, timeStringToMinutes, combine } from "@/server/lib/time";
import { getWeekSummary, getDaySummary } from "@/server/services/study";
import { getTaskBuckets } from "@/server/services/tasks";
import { listReminders } from "@/server/services/reminders";

export type Band = { minPercent: number; gradePoint: number; letter: string };

export type AssessmentWithGrade = Assessment & { obtainedMarks: number | null };

export type CourseProgress = {
  courseId: string;
  code: string;
  name: string;
  credits: number;
  assessments: AssessmentWithGrade[];
  /** weight already graded, as a percentage of the course */
  gradedWeight: number;
  /** percentage earned across the assessments that are graded */
  earnedPercentOfGraded: number | null;
  /** percentage of the whole course currently secured */
  securedPercent: number;
  /** best percentage still reachable if every remaining assessment is perfect */
  maxPossiblePercent: number;
  remainingWeight: number;
  totalMaxMarks: number;
  totalObtained: number;
  gradePoint: number | null;
  letter: string | null;
};

export async function defaultBands(userId: string): Promise<Band[]> {
  const [rule] = await db
    .select()
    .from(gradingRules)
    .where(eq(gradingRules.userId, userId))
    .orderBy(sql`${gradingRules.isDefault} desc`)
    .limit(1);
  return (rule?.bands ?? []) as Band[];
}

export function gradePointForPercent(percent: number, bands: Band[]): { gradePoint: number; letter: string } | null {
  if (!bands.length) return null;
  const ordered = [...bands].sort((a, b) => b.minPercent - a.minPercent);
  for (const band of ordered) {
    if (percent >= band.minPercent) return { gradePoint: band.gradePoint, letter: band.letter };
  }
  const last = ordered[ordered.length - 1]!;
  return { gradePoint: last.gradePoint, letter: last.letter };
}

/**
 * Weighted course progress. Every number here is derived from stored marks —
 * nothing is estimated, predicted or hardcoded (§17).
 */
export function computeCourseProgress(course: Course, items: AssessmentWithGrade[], bands: Band[]): CourseProgress {
  let gradedWeight = 0;
  let weightedEarned = 0;
  let totalMax = 0;
  let totalObtained = 0;

  for (const item of items) {
    const weight = Number(item.weight);
    const max = Number(item.maxMarks);
    totalMax += max;
    if (item.obtainedMarks !== null && max > 0) {
      totalObtained += Number(item.obtainedMarks);
      gradedWeight += weight;
      weightedEarned += (Number(item.obtainedMarks) / max) * weight;
    }
  }

  const earnedPercentOfGraded = gradedWeight > 0 ? (weightedEarned / gradedWeight) * 100 : null;
  const securedPercent = weightedEarned; // weight already banked
  const remainingWeight = Math.max(0, 100 - gradedWeight);
  const maxPossiblePercent = Math.min(100, securedPercent + remainingWeight);

  const basis = course.awardedGradePoint !== null ? null : earnedPercentOfGraded;
  const derived = basis !== null ? gradePointForPercent(basis, bands) : null;

  return {
    courseId: course.id,
    code: course.code,
    name: course.name,
    credits: Number(course.credits),
    assessments: items,
    gradedWeight,
    earnedPercentOfGraded,
    securedPercent,
    maxPossiblePercent,
    remainingWeight,
    totalMaxMarks: totalMax,
    totalObtained,
    gradePoint: course.awardedGradePoint !== null ? Number(course.awardedGradePoint) : derived?.gradePoint ?? null,
    letter: course.awardedLetter ?? derived?.letter ?? null,
  };
}

export async function getCourseProgress(userId: string, courseId: string, bands?: Band[]): Promise<CourseProgress | null> {
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);
  if (!course) return null;
  const items = await listAssessments(userId, courseId);
  return computeCourseProgress(course, items, bands ?? (await defaultBands(userId)));
}

export async function listAssessments(userId: string, courseId: string): Promise<AssessmentWithGrade[]> {
  const rows = await db
    .select({ assessment: assessments, obtainedMarks: grades.obtainedMarks })
    .from(assessments)
    .leftJoin(grades, eq(grades.assessmentId, assessments.id))
    .where(and(eq(assessments.courseId, courseId), eq(assessments.userId, userId)))
    .orderBy(asc(assessments.scheduledFor), asc(assessments.name));
  return rows.map((row) => ({
    ...row.assessment,
    obtainedMarks: row.obtainedMarks === null ? null : Number(row.obtainedMarks),
  }));
}

export type CgpaResult = {
  courses: Array<{ code: string; name: string; credits: number; gradePoint: number | null; letter: string | null }>;
  creditsCounted: number;
  cgpa: number | null;
};

/** Credit-weighted — the only correct way to average grade points. */
export function computeCgpa(
  rows: Array<{ code: string; name: string; credits: number; gradePoint: number | null; letter: string | null }>,
): CgpaResult {
  const counted = rows.filter((r) => r.gradePoint !== null);
  const totalCredits = counted.reduce((sum, r) => sum + r.credits, 0);
  const weighted = counted.reduce((sum, r) => sum + r.credits * (r.gradePoint ?? 0), 0);
  return {
    courses: rows,
    creditsCounted: totalCredits,
    cgpa: totalCredits > 0 ? Number((weighted / totalCredits).toFixed(2)) : null,
  };
}

export async function semesterCgpa(userId: string, semesterId: string): Promise<CgpaResult> {
  const bands = await defaultBands(userId);
  const semesterCourses = await db
    .select()
    .from(courses)
    .where(and(eq(courses.semesterId, semesterId), eq(courses.userId, userId), isNull(courses.archivedAt)));

  const rows = [];
  for (const course of semesterCourses) {
    const items = await listAssessments(userId, course.id);
    const progress = computeCourseProgress(course, items, bands);
    rows.push({
      code: course.code,
      name: course.name,
      credits: Number(course.credits),
      gradePoint: progress.gradePoint,
      letter: progress.letter,
    });
  }
  return computeCgpa(rows);
}

export async function overallCgpa(userId: string): Promise<CgpaResult> {
  const bands = await defaultBands(userId);
  const all = await db.select().from(courses).where(and(eq(courses.userId, userId), isNull(courses.archivedAt)));
  const rows = [];
  for (const course of all) {
    const items = await listAssessments(userId, course.id);
    const progress = computeCourseProgress(course, items, bands);
    rows.push({
      code: course.code,
      name: course.name,
      credits: Number(course.credits),
      gradePoint: progress.gradePoint,
      letter: progress.letter,
    });
  }
  return computeCgpa(rows);
}

/* ------------------------------------------------------------------ */
/* academic target calculator (§18) — arithmetic, not prediction        */
/* ------------------------------------------------------------------ */

export type Feasibility = {
  target: number;
  achievable: boolean;
  bestPossible: number | null;
  /** highest achievable grade point at or below the target */
  alternatives: number[];
  detail: string;
};

export async function evaluateTarget(userId: string, semesterId: string, target: number): Promise<Feasibility> {
  const bands = await defaultBands(userId);
  const semesterCourses = await db
    .select()
    .from(courses)
    .where(and(eq(courses.semesterId, semesterId), eq(courses.userId, userId), isNull(courses.archivedAt)));

  let credits = 0;
  let secured = 0;
  let bestCase = 0;

  for (const course of semesterCourses) {
    const items = await listAssessments(userId, course.id);
    const progress = computeCourseProgress(course, items, bands);
    const weight = Number(course.credits);
    credits += weight;

    if (course.awardedGradePoint !== null) {
      const gp = Number(course.awardedGradePoint);
      secured += weight * gp;
      bestCase += weight * gp;
      continue;
    }

    // Marks already earned count as-is; ungraded assessments count as 0 now and
    // as full marks in the best case.
    const currentPercent = progress.earnedPercentOfGraded ?? 0;
    const currentGp = gradePointForPercent(progress.securedPercent, bands)?.gradePoint ?? 0;
    const bestGp = gradePointForPercent(progress.maxPossiblePercent, bands)?.gradePoint ?? 0;
    void currentPercent;
    secured += weight * currentGp;
    bestCase += weight * bestGp;
  }

  if (credits === 0) {
    return { target, achievable: false, bestPossible: null, alternatives: [], detail: "No courses in this semester yet." };
  }

  const bestCgpa = Number((bestCase / credits).toFixed(2));
  const achievable = bestCgpa >= target;
  const scale = [...new Set(bands.map((b) => b.gradePoint))].sort((a, b) => b - a);
  const alternatives = achievable ? [] : scale.filter((gp) => gp < target && gp <= bestCgpa).slice(0, 3);

  return {
    target,
    achievable,
    bestPossible: bestCgpa,
    alternatives,
    detail: achievable
      ? `Reaching ${target.toFixed(2)} is arithmetically possible — you can still score up to ${bestCgpa.toFixed(2)} if every remaining assessment is perfect.`
      : `${target.toFixed(2)} is no longer reachable: even with full marks on everything left, the maximum is ${bestCgpa.toFixed(2)}.`,
  };
}

/* ------------------------------------------------------------------ */
/* dashboard aggregation                                               */
/* ------------------------------------------------------------------ */

export type TodayClass = {
  id: string;
  title: string;
  code: string | null;
  start: Date;
  end: Date;
  room: string | null;
  source: "schedule" | "event";
};

export async function todayClasses(userId: string, dayKey: string, timeZone: string): Promise<TodayClass[]> {
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();
  const scheduled = await db
    .select({
      id: classSchedules.id,
      startTime: classSchedules.startTime,
      endTime: classSchedules.endTime,
      room: classSchedules.room,
      code: courses.code,
      name: courses.name,
    })
    .from(classSchedules)
    .innerJoin(courses, eq(courses.id, classSchedules.courseId))
    .where(and(eq(classSchedules.userId, userId), eq(classSchedules.dayOfWeek, weekday), eq(classSchedules.active, true)));

  const range = {
    start: combine(dayKey, "00:00:00", timeZone),
    end: combine(shiftDayKey(dayKey, 1), "00:00:00", timeZone),
  };

  const oneOff = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        eq(calendarEvents.kind, "class"),
        gte(calendarEvents.startsAt, range.start),
        lt(calendarEvents.startsAt, range.end),
        isNull(calendarEvents.archivedAt),
      ),
    );

  const fromSchedule: TodayClass[] = scheduled.map((slot) => ({
    id: slot.id,
    title: slot.name,
    code: slot.code,
    start: combine(dayKey, slot.startTime, timeZone),
    end: combine(dayKey, slot.endTime, timeZone),
    room: slot.room,
    source: "schedule" as const,
  }));

  const fromEvents: TodayClass[] = oneOff.map((event) => ({
    id: event.id,
    title: event.title,
    code: null,
    start: event.startsAt,
    end: event.endsAt ?? event.startsAt,
    room: event.location,
    source: "event" as const,
  }));

  return [...fromSchedule, ...fromEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type Deadline = {
  id: string;
  title: string;
  kind: "task" | "assessment" | "opportunity";
  dueKey: string;
  href: string;
  meta?: string;
};

export async function upcomingDeadlines(userId: string, dayKey: string, days = 14): Promise<Deadline[]> {
  const horizon = shiftDayKey(dayKey, days);

  const dueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.status, ["todo", "in_progress"]),
        isNull(tasks.archivedAt),
        sql`${tasks.dueDate} is not null and ${tasks.dueDate} <= ${horizon}`,
      ),
    )
    .orderBy(asc(tasks.dueDate))
    .limit(50);

  const dueAssessments = await db
    .select({ assessment: assessments, code: courses.code })
    .from(assessments)
    .innerJoin(courses, eq(courses.id, assessments.courseId))
    .where(
      and(
        eq(assessments.userId, userId),
        // Only future or same-day assessments: a past assessment is history,
        // not an upcoming deadline.
        sql`${assessments.scheduledFor} is not null and ${assessments.scheduledFor} >= ${dayKey} and ${assessments.scheduledFor} <= ${horizon}`,
      ),
    )
    .orderBy(asc(assessments.scheduledFor))
    .limit(50);

  const dueOpportunities = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.userId, userId),
        inArray(opportunities.status, ["interested", "applied"]),
        isNull(opportunities.archivedAt),
        sql`${opportunities.deadline} is not null and ${opportunities.deadline} >= ${dayKey} and ${opportunities.deadline} <= ${horizon}`,
      ),
    )
    .orderBy(asc(opportunities.deadline))
    .limit(50);

  const merged: Deadline[] = [
    ...dueTasks.map((task) => ({
      id: task.id,
      title: task.title,
      kind: "task" as const,
      dueKey: task.dueDate!,
      href: "/tasks",
      meta: task.priority === "urgent" || task.priority === "high" ? task.priority : undefined,
    })),
    ...dueAssessments.map((row) => ({
      id: row.assessment.id,
      title: `${row.code} — ${row.assessment.name}`,
      kind: "assessment" as const,
      dueKey: row.assessment.scheduledFor!,
      href: "/academic/grades",
      meta: row.assessment.kind,
    })),
    ...dueOpportunities.map((opp) => ({
      id: opp.id,
      title: opp.name,
      kind: "opportunity" as const,
      dueKey: opp.deadline!,
      href: "/opportunities",
      meta: opp.type,
    })),
  ];

  return merged.sort((a, b) => a.dueKey.localeCompare(b.dueKey));
}

export type CurrentState = {
  semester: { id: string; name: string } | null;
  activeCourses: number;
  activeProjects: number;
  booksReading: number;
  activeOpportunities: number;
  upcomingDeadlineCount: number;
  weekStudySeconds: number;
  todayStudySeconds: number;
  cgpa: number | null;
};

export async function getCurrentState(userId: string, dayKey: string, timeZone: string): Promise<CurrentState> {
  const [semester] = await db
    .select()
    .from(semesters)
    .where(and(eq(semesters.userId, userId), eq(semesters.status, "active"), isNull(semesters.archivedAt)))
    .limit(1);

  const [courseRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(courses)
    .where(and(eq(courses.userId, userId), eq(courses.status, "active"), isNull(courses.archivedAt)));

  const [projectRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.status, "active"), isNull(projects.archivedAt)));

  const [bookRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.status, "reading"), isNull(books.archivedAt)));

  const [oppRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(opportunities)
    .where(
      and(
        eq(opportunities.userId, userId),
        inArray(opportunities.status, ["interested", "applied"]),
        isNull(opportunities.archivedAt),
      ),
    );

  const deadlines = await upcomingDeadlines(userId, dayKey, 7);
  const week = await getWeekSummary(userId, dayKey, timeZone);
  const today = await getDaySummary(userId, dayKey, timeZone);
  const cgpa = semester ? await semesterCgpa(userId, semester.id) : null;

  return {
    semester: semester ? { id: semester.id, name: semester.name } : null,
    activeCourses: Number(courseRow?.count ?? 0),
    activeProjects: Number(projectRow?.count ?? 0),
    booksReading: Number(bookRow?.count ?? 0),
    activeOpportunities: Number(oppRow?.count ?? 0),
    upcomingDeadlineCount: deadlines.length,
    weekStudySeconds: week.totalSeconds,
    todayStudySeconds: today.totalSeconds,
    cgpa: cgpa?.cgpa ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* "What should I do now?" — deterministic rules (§7)                  */
/* ------------------------------------------------------------------ */

export type NextAction = {
  id: string;
  title: string;
  why: string;
  tone: "urgent" | "focus" | "info";
  actions: Array<{ label: string; href: string }>;
};

export async function buildNextActions(userId: string, dayKey: string, timeZone: string, now = new Date()): Promise<NextAction[]> {
  const actions: NextAction[] = [];
  const classes = await todayClasses(userId, dayKey, timeZone);
  const nextClass = classes.find((c) => c.end.getTime() > now.getTime());
  if (nextClass) {
    const hours = (nextClass.start.getTime() - now.getTime()) / 3_600_000;
    if (hours > 0 && hours <= 3) {
      actions.push({
        id: `class-${nextClass.id}`,
        title: `Your next class (${nextClass.code ?? nextClass.title}) starts in ${Math.round(hours * 60)} minutes`,
        why: "It is on today's schedule and starts within the next three hours.",
        tone: hours <= 1 ? "urgent" : "focus",
        actions: [{ label: "Open calendar", href: "/calendar" }],
      });
    }
  }

  const buckets = await getTaskBuckets(userId, timeZone, now);
  const overdue = buckets.overdue[0];
  if (overdue) {
    actions.push({
      id: `overdue-${overdue.id}`,
      title: `"${overdue.title}" is overdue`,
      why: `It was due on ${overdue.dueDate} and is still ${overdue.status === "in_progress" ? "in progress" : "not started"}.`,
      tone: "urgent",
      actions: [{ label: "Open task", href: "/tasks" }],
    });
  }

  const dueToday = buckets.today[0];
  if (dueToday) {
    actions.push({
      id: `today-${dueToday.id}`,
      title: `"${dueToday.title}" is due today`,
      why: "It is on today's list and has not been completed.",
      tone: "focus",
      actions: [{ label: "Open task", href: "/tasks" }],
    });
  }

  const day = await getDaySummary(userId, dayKey, timeZone);
  const DAILY_TARGET_SECONDS = 2 * 3600;
  if (day.totalSeconds < DAILY_TARGET_SECONDS) {
    const remaining = DAILY_TARGET_SECONDS - day.totalSeconds;
    actions.push({
      id: "study-target",
      title:
        day.totalSeconds === 0
          ? "You have not studied on your own today"
          : `You are ${Math.round(remaining / 60)} minutes short of today's 2h self-study target`,
      why: `Self-study logged today: ${Math.round(day.totalSeconds / 60)} minutes. University class time is not counted.`,
      tone: "focus",
      actions: [{ label: "Start study", href: "/study" }],
    });
  }

  const deadlines = await upcomingDeadlines(userId, dayKey, 3);
  const soon = deadlines.find((d) => d.kind === "assessment" || d.kind === "task");
  if (soon) {
    actions.push({
      id: `deadline-${soon.id}`,
      title: `${soon.title} is due on ${soon.dueKey}`,
      why: "It falls inside the next three days.",
      tone: soon.dueKey <= dayKey ? "urgent" : "focus",
      actions: [{ label: "Open", href: soon.href }],
    });
  }

  const [reading] = await db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), eq(books.status, "reading"), isNull(books.archivedAt)))
    .orderBy(sql`${books.updatedAt} desc`)
    .limit(1);
  if (reading && reading.totalPages && reading.dailyPageTarget) {
    const remainingPages = Math.max(0, reading.totalPages - reading.currentPage);
    if (remainingPages > 0) {
      actions.push({
        id: `book-${reading.id}`,
        title: `Read ${reading.dailyPageTarget} pages of "${reading.title}"`,
        why: `${remainingPages} pages left to finish, with a daily target of ${reading.dailyPageTarget} pages.`,
        tone: "info",
        actions: [{ label: "Open book", href: "/learning/books" }],
      });
    }
  }

  const [prayerRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(prayerLogs)
    .where(and(eq(prayerLogs.userId, userId), eq(prayerLogs.day, dayKey)));
  if (Number(prayerRow?.count ?? 0) < 5) {
    actions.push({
      id: "prayer",
      title: "Log today's prayers",
      why: "Fewer than five prayers are recorded for today.",
      tone: "info",
      actions: [{ label: "Open prayer log", href: "/life/prayer" }],
    });
  }

  const reminders = await listReminders(userId, { status: ["sent", "queued", "delivered"], limit: 5 });
  for (const reminder of reminders.slice(0, 1)) {
    actions.push({
      id: `reminder-${reminder.id}`,
      title: reminder.title,
      why: "A reminder fired and has not been marked complete yet.",
      tone: "info",
      actions: [{ label: "Open reminders", href: "/reminders" }],
    });
  }

  return actions.slice(0, 5);
}

export type TodayPayload = {
  dayKey: string;
  classes: TodayClass[];
  tasks: { today: number; overdue: number; completedToday: number; items: Array<{ id: string; title: string; status: string; priority: string }> };
  deadlines: Deadline[];
  reminders: Array<{ id: string; title: string; remindAt: string; status: string }>;
  studySeconds: number;
  universitySeconds: number;
};

export async function getToday(userId: string, dayKey: string, timeZone: string, now = new Date()): Promise<TodayPayload> {
  const [classes, buckets, deadlines, day, reminderRows] = await Promise.all([
    todayClasses(userId, dayKey, timeZone),
    getTaskBuckets(userId, timeZone, now),
    upcomingDeadlines(userId, dayKey, 7),
    getDaySummary(userId, dayKey, timeZone),
    listReminders(userId, { limit: 20 }),
  ]);

  const startOfDay = combine(dayKey, "00:00:00", timeZone);
  const endOfDay = combine(shiftDayKey(dayKey, 1), "00:00:00", timeZone);

  return {
    dayKey,
    classes,
    tasks: {
      today: buckets.counts.today,
      overdue: buckets.counts.overdue,
      completedToday: buckets.counts.completedToday,
      items: [...buckets.overdue, ...buckets.today].slice(0, 8).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
    },
    deadlines: deadlines.slice(0, 8),
    reminders: reminderRows
      .filter((r) => r.remindAt >= startOfDay && r.remindAt < endOfDay)
      .map((r) => ({ id: r.id, title: r.title, remindAt: r.remindAt.toISOString(), status: r.status })),
    studySeconds: day.totalSeconds,
    universitySeconds: day.universitySeconds,
  };
}

export { toLocalDayKey };
