import "server-only";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  achievements,
  books,
  concepts,
  courses,
  notes,
  opportunities,
  projects,
  questions,
  readingSessions,
  skillEvidence,
  skills,
  studySessions,
  tasks,
  users,
  classSchedules,
} from "@/server/db/schema";
import { timeStringToMinutes } from "@/server/lib/time";

/**
 * Analytics (§40).
 *
 * Everything here is a count, a sum or a distribution of rows the user actually
 * created. There is deliberately no "productivity score": a single number
 * blending study hours, task completion and sleep would be invented, and it
 * would be the first thing people optimise instead of the work.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Drizzle qualifies columns inside GROUP BY but not inside SELECT, so a
 * `sql` expression built from a Column renders differently in the two places
 * and Postgres rejects the grouping. Qualifying the column by hand makes both
 * sides byte-identical. The timezone is always a bound parameter.
 */
const dayKeyExpr =
  (qualifiedColumn: string) =>
  (timeZone: string): ReturnType<typeof sql<string>> =>
    sql`to_char(${sql.raw(qualifiedColumn)} at time zone ${timeZone}, 'YYYY-MM-DD')`;

const studyDay = dayKeyExpr('"study_sessions"."started_at"');
const taskDay = dayKeyExpr('"tasks"."completed_at"');
const readingDay = dayKeyExpr('"reading_sessions"."started_at"');

/**
 * Correlated task-count subquery for the projects table, qualified by hand for
 * the same reason as `studySessionsFor`.
 */
const tasksFor = (completedOnly: boolean) => sql<number>`(
  select count(*) from "tasks"
  where "tasks"."project_id" = "projects"."id"
    and "tasks"."archived_at" is null${completedOnly ? sql` and "tasks"."status" = 'completed'` : sql``}
)`;

/**
 * Correlated study-time subquery for the projects table.
 *
 * Every column reference has to be qualified by hand: in a query with no join,
 * drizzle renders `${table.column}` as a bare `"column"`, so both sides of the
 * correlation bind to the inner table and the sum silently comes back zero.
 * `since` is null (no cutoff) or a bound ISO timestamp.
 */
const studySessionsFor = (since: string | null) => sql`(
  select sum("study_sessions"."duration_seconds") from "study_sessions"
  where "study_sessions"."project_id" = "projects"."id"
    and "study_sessions"."status" = 'completed'
    and "study_sessions"."started_at" >= coalesce(${since}, '-infinity'::timestamptz)
)`;

export type Range = 7 | 30 | 90 | 365;

function fromDays(range: Range): Date {
  return new Date(Date.now() - range * MS_PER_DAY);
}

/* ------------------------------- study time -------------------------------- */

export type StudyTrendPoint = { dayKey: string; seconds: number; sessions: number };

/** Daily study seconds for the range, with empty days present (zeros are data). */
export async function studyTrend(userId: string, range: Range, timeZone: string): Promise<StudyTrendPoint[]> {
  const rows = await db
    .select({
      dayKey: studyDay(timeZone),
      seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)`,
      sessions: sql<number>`count(*)`,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.status, "completed"),
        gte(studySessions.startedAt, fromDays(range)),
      ),
    )
    .groupBy(sql.raw("1"));

  const byDay = new Map(rows.map((row) => [row.dayKey, row]));

  const points: StudyTrendPoint[] = [];
  for (let offset = range - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * MS_PER_DAY);
    const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    const row = byDay.get(dayKey);
    points.push({
      dayKey,
      seconds: Number(row?.seconds ?? 0),
      sessions: Number(row?.sessions ?? 0),
    });
  }
  return points;
}

export type StudyTotals = {
  range: Range;
  seconds: number;
  sessions: number;
  daysStudied: number;
  /** days studied / days in range — a real ratio, not a grade */
  consistency: number;
  averagePerStudiedDay: number;
  longestSessionSeconds: number;
  previousSeconds: number;
  /** percent change against the preceding window of the same length */
  changePercent: number | null;
};

export async function studyTotals(userId: string, range: Range, timeZone: string): Promise<StudyTotals> {
  const from = fromDays(range);
  const previousFrom = new Date(from.getTime() - range * MS_PER_DAY);

  const [current, previous] = await Promise.all([
    db
      .select({
        seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)`,
        sessions: sql<number>`count(*)`,
        days: sql<number>`count(distinct ${studyDay(timeZone)})`,
        longest: sql<number>`coalesce(max(${studySessions.durationSeconds}), 0)`,
      })
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "completed"), gte(studySessions.startedAt, from))),
    db
      .select({ seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)` })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, "completed"),
          gte(studySessions.startedAt, previousFrom),
          lte(studySessions.startedAt, from),
        ),
      ),
  ]);

  const seconds = Number(current[0]?.seconds ?? 0);
  const previousSeconds = Number(previous[0]?.seconds ?? 0);

  return {
    range,
    seconds,
    sessions: Number(current[0]?.sessions ?? 0),
    daysStudied: Number(current[0]?.days ?? 0),
    consistency: Math.round((Number(current[0]?.days ?? 0) / range) * 100),
    averagePerStudiedDay: Number(current[0]?.days ?? 0) > 0 ? Math.round(seconds / Number(current[0]?.days)) : 0,
    longestSessionSeconds: Number(current[0]?.longest ?? 0),
    previousSeconds,
    changePercent: previousSeconds > 0 ? Math.round(((seconds - previousSeconds) / previousSeconds) * 100) : null,
  };
}

export type Slice = { key: string; label: string; seconds: number; sessions: number; percent: number };

async function sliceBy(
  userId: string,
  range: Range,
  column: "course" | "book" | "project",
): Promise<Slice[]> {
  const join =
    column === "course"
      ? { table: courses, id: courses.id, label: courses.name, fk: studySessions.courseId }
      : column === "book"
        ? { table: books, id: books.id, label: books.title, fk: studySessions.bookId }
        : { table: projects, id: projects.id, label: projects.name, fk: studySessions.projectId };

  const rows = await db
    .select({
      key: sql<string>`${join.id}`,
      label: sql<string>`${join.label}`,
      seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)`,
      sessions: sql<number>`count(*)`,
    })
    .from(studySessions)
    .innerJoin(join.table, eq(join.id, join.fk))
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.status, "completed"),
        gte(studySessions.startedAt, fromDays(range)),
      ),
    )
    .groupBy(join.id, join.label)
    .orderBy(desc(sql`sum(${studySessions.durationSeconds})`))
    .limit(12);

  const total = rows.reduce((sum, row) => sum + Number(row.seconds), 0);
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    seconds: Number(row.seconds),
    sessions: Number(row.sessions),
    percent: total > 0 ? Math.round((Number(row.seconds) / total) * 100) : 0,
  }));
}

/** Where the study time actually went, split by what it was attached to. */
export async function studyDistribution(userId: string, range: Range) {
  const [byCourse, byBook, byProject, unlinked] = await Promise.all([
    sliceBy(userId, range, "course"),
    sliceBy(userId, range, "book"),
    sliceBy(userId, range, "project"),
    db
      .select({ seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)` })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, "completed"),
          gte(studySessions.startedAt, fromDays(range)),
          sql`${studySessions.courseId} is null and ${studySessions.bookId} is null and ${studySessions.projectId} is null`,
        ),
      ),
  ]);

  return {
    byCourse,
    byBook,
    byProject,
    unlinkedSeconds: Number(unlinked[0]?.seconds ?? 0),
  };
}

/** Hour-of-day distribution, in the user's own timezone. */
export async function studyByHour(userId: string, range: Range, timeZone: string) {
  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${sql.raw('"study_sessions"."started_at"')} at time zone ${timeZone})::int`,
      seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)`,
      sessions: sql<number>`count(*)`,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.status, "completed"),
        gte(studySessions.startedAt, fromDays(range)),
      ),
    )
    .groupBy(sql.raw("1"));

  const byHour = new Map(rows.map((row) => [Number(row.hour), row]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    seconds: Number(byHour.get(hour)?.seconds ?? 0),
    sessions: Number(byHour.get(hour)?.sessions ?? 0),
  }));
}

/** Weekday distribution, labelled in the user's locale. */
export async function studyByWeekday(userId: string, range: Range, timeZone: string) {
  const rows = await db
    .select({
      weekday: sql<number>`extract(isodow from ${sql.raw('"study_sessions"."started_at"')} at time zone ${timeZone})::int`,
      seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)`,
      sessions: sql<number>`count(*)`,
    })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.status, "completed"),
        gte(studySessions.startedAt, fromDays(range)),
      ),
    )
    .groupBy(sql.raw("1"));

  const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const byWeekday = new Map(rows.map((row) => [Number(row.weekday), row]));

  return Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    label: labels[index]!,
    seconds: Number(byWeekday.get(index + 1)?.seconds ?? 0),
    sessions: Number(byWeekday.get(index + 1)?.sessions ?? 0),
  }));
}

/* --------------------------------- tasks ----------------------------------- */

export async function taskAnalytics(userId: string, range: Range, timeZone: string) {
  const from = fromDays(range);

  const [totals] = await db
    .select({
      open: sql<number>`count(*) filter (where ${tasks.status} in ('todo','in_progress') and ${tasks.archivedAt} is null)`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')`,
      completedInRange: sql<number>`count(*) filter (where ${tasks.status} = 'completed' and ${tasks.completedAt} >= ${from.toISOString()})`,
      overdue: sql<number>`count(*) filter (where ${tasks.status} in ('todo','in_progress') and ${tasks.archivedAt} is null and ${tasks.dueDate} < current_date)`,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId));

  const trend = await db
    .select({
      dayKey: taskDay(timeZone),
      count: sql<number>`count(*)`,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, "completed"), gte(tasks.completedAt, from)))
    .groupBy(sql.raw("1"))
    .orderBy(sql.raw("1"));

  const byPriority = await db
    .select({ priority: sql<string>`${tasks.priority}::text`, count: sql<number>`count(*)` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.archivedAt), sql`${tasks.status} in ('todo','in_progress')`))
    .groupBy(tasks.priority);

  const byBucket = await db
    .select({ bucket: sql<string>`${tasks.bucket}::text`, count: sql<number>`count(*)` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.archivedAt), sql`${tasks.status} in ('todo','in_progress')`))
    .groupBy(tasks.bucket);

  return {
    open: Number(totals?.open ?? 0),
    completed: Number(totals?.completed ?? 0),
    completedInRange: Number(totals?.completedInRange ?? 0),
    overdue: Number(totals?.overdue ?? 0),
    trend: trend.map((row) => ({ dayKey: row.dayKey, count: Number(row.count) })),
    byPriority: byPriority.map((row) => ({ priority: row.priority, count: Number(row.count) })),
    byBucket: byBucket.map((row) => ({ bucket: row.bucket, count: Number(row.count) })),
  };
}

/* --------------------------------- reading --------------------------------- */

export async function readingAnalytics(userId: string, range: Range, timeZone: string) {
  const from = fromDays(range);

  const [totals] = await db
    .select({
      pages: sql<number>`coalesce(sum(${readingSessions.pagesRead}), 0)`,
      seconds: sql<number>`coalesce(sum(${readingSessions.durationSeconds}), 0)`,
      sessions: sql<number>`count(*)`,
      days: sql<number>`count(distinct ${readingDay(timeZone)})`,
    })
    .from(readingSessions)
    .where(and(eq(readingSessions.userId, userId), gte(readingSessions.startedAt, from)));

  const byBook = await db
    .select({
      key: sql<string>`${books.id}`,
      label: sql<string>`${books.title}`,
      pages: sql<number>`coalesce(sum(${readingSessions.pagesRead}), 0)`,
      seconds: sql<number>`coalesce(sum(${readingSessions.durationSeconds}), 0)`,
    })
    .from(readingSessions)
    .innerJoin(books, eq(books.id, readingSessions.bookId))
    .where(and(eq(readingSessions.userId, userId), gte(readingSessions.startedAt, from)))
    .groupBy(books.id, books.title)
    .orderBy(desc(sql`sum(${readingSessions.pagesRead})`))
    .limit(10);

  const [booksRow] = await db
    .select({
      reading: sql<number>`count(*) filter (where ${books.status} = 'reading')`,
      completed: sql<number>`count(*) filter (where ${books.status} = 'completed' and ${books.archivedAt} is null)`,
    })
    .from(books)
    .where(eq(books.userId, userId));

  return {
    pages: Number(totals?.pages ?? 0),
    seconds: Number(totals?.seconds ?? 0),
    sessions: Number(totals?.sessions ?? 0),
    daysRead: Number(totals?.days ?? 0),
    booksReading: Number(booksRow?.reading ?? 0),
    booksCompleted: Number(booksRow?.completed ?? 0),
    byBook: byBook.map((row) => ({
      key: row.key,
      label: row.label,
      pages: Number(row.pages),
      seconds: Number(row.seconds),
    })),
  };
}

/* --------------------------------- learning -------------------------------- */

export async function learningAnalytics(userId: string, range: Range) {
  const from = fromDays(range);

  const [counts] = await db
    .select({
      concepts: sql<number>`(select count(*) from ${concepts} where ${concepts.userId} = ${userId})`,
      notes: sql<number>`(select count(*) from ${notes} where ${notes.userId} = ${userId} and ${notes.archivedAt} is null)`,
      openQuestions: sql<number>`(select count(*) from ${questions} where ${questions.userId} = ${userId} and ${questions.status} in ('open','researching') and ${questions.archivedAt} is null)`,
      answeredQuestions: sql<number>`(select count(*) from ${questions} where ${questions.userId} = ${userId} and ${questions.status} = 'answered')`,
      evidence: sql<number>`(select count(*) from ${skillEvidence} where ${skillEvidence.userId} = ${userId})`,
      evidenceInRange: sql<number>`(select count(*) from ${skillEvidence} where ${skillEvidence.userId} = ${userId} and ${skillEvidence.createdAt} >= ${from.toISOString()})`,
    })
    .from(users)
    .where(eq(users.id, userId));

  const byStage = await db
    .select({ stage: sql<string>`${skills.stage}::text`, count: sql<number>`count(*)` })
    .from(skills)
    .where(and(eq(skills.userId, userId), isNull(skills.archivedAt)))
    .groupBy(skills.stage);

  const conceptStatus = await db
    .select({ status: sql<string>`${concepts.status}::text`, count: sql<number>`count(*)` })
    .from(concepts)
    .where(eq(concepts.userId, userId))
    .groupBy(concepts.status);

  return {
    concepts: Number(counts?.concepts ?? 0),
    notes: Number(counts?.notes ?? 0),
    openQuestions: Number(counts?.openQuestions ?? 0),
    answeredQuestions: Number(counts?.answeredQuestions ?? 0),
    evidence: Number(counts?.evidence ?? 0),
    evidenceInRange: Number(counts?.evidenceInRange ?? 0),
    skillsByStage: byStage.map((row) => ({ stage: row.stage, count: Number(row.count) })),
    conceptsByStatus: conceptStatus.map((row) => ({ status: row.status, count: Number(row.count) })),
  };
}

/* ------------------------------ opportunities ------------------------------ */

export async function opportunityAnalytics(userId: string) {
  const rows = await db
    .select({ status: sql<string>`${opportunities.status}::text`, count: sql<number>`count(*)` })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), isNull(opportunities.archivedAt)))
    .groupBy(opportunities.status);

  const byType = await db
    .select({ type: sql<string>`${opportunities.type}::text`, count: sql<number>`count(*)` })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), isNull(opportunities.archivedAt)))
    .groupBy(opportunities.type);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = Number(row.count);

  const applied = counts.applied ?? 0;
  const decided = applied + (counts.accepted ?? 0) + (counts.rejected ?? 0);

  return {
    byStatus: rows.map((row) => ({ status: row.status, count: Number(row.count) })),
    byType: byType.map((row) => ({ type: row.type, count: Number(row.count) })),
    applied,
    accepted: counts.accepted ?? 0,
    rejected: counts.rejected ?? 0,
    /** accepted / decided — only meaningful once there are decisions to count */
    successRate: decided > 0 ? Math.round(((counts.accepted ?? 0) / decided) * 100) : null,
  };
}

/* -------------------------------- projects --------------------------------- */

export async function projectAnalytics(userId: string, range: Range) {
  const from = fromDays(range);

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      studySeconds: sql<number>`coalesce(${studySessionsFor(null)}, 0)`,
      studyInRange: sql<number>`coalesce(${studySessionsFor(from.toISOString())}, 0)`,
      tasksTotal: tasksFor(false),
      tasksDone: tasksFor(true),
    })
    .from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))
    .orderBy(desc(sql`coalesce(${studySessionsFor(null)}, 0)`))
    .limit(10);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    studySeconds: Number(row.studySeconds),
    studyInRange: Number(row.studyInRange),
    tasksTotal: Number(row.tasksTotal),
    tasksDone: Number(row.tasksDone),
  }));
}

/* ------------------------------- achievements ------------------------------ */

export async function achievementAnalytics(userId: string) {
  const byYear = await db
    .select({
      year: sql<string>`to_char(${achievements.occurredOn}, 'YYYY')`,
      count: sql<number>`count(*)`,
    })
    .from(achievements)
    .where(and(eq(achievements.userId, userId), isNull(achievements.archivedAt)))
    .groupBy(sql`to_char(${achievements.occurredOn}, 'YYYY')`)
    .orderBy(sql`to_char(${achievements.occurredOn}, 'YYYY')`);

  const byCategory = await db
    .select({ category: sql<string>`${achievements.category}::text`, count: sql<number>`count(*)` })
    .from(achievements)
    .where(and(eq(achievements.userId, userId), isNull(achievements.archivedAt)))
    .groupBy(achievements.category)
    .orderBy(desc(sql`count(*)`));

  return {
    byYear: byYear.map((row) => ({ year: row.year, count: Number(row.count) })),
    byCategory: byCategory.map((row) => ({ category: row.category, count: Number(row.count) })),
  };
}

/* ---------------------------- university vs self --------------------------- */

/**
 * Class time and self-study, side by side and never merged (§12).
 *
 * Class time is computed from the weekly timetable and scaled by the number of
 * weeks in the window; self-study comes from the study timer. They are
 * different activities, so the totals are reported separately.
 */
export async function academicTimeSplit(userId: string, range: Range) {
  const from = fromDays(range);

  const [self] = await db
    .select({ seconds: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)` })
    .from(studySessions)
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.status, "completed"),
        gte(studySessions.startedAt, from),
      ),
    );

  const slots = await db
    .select({ startTime: classSchedules.startTime, endTime: classSchedules.endTime })
    .from(classSchedules)
    .where(and(eq(classSchedules.userId, userId), eq(classSchedules.active, true)));

  let weeklyClassSeconds = 0;
  for (const slot of slots) {
    const fromMinutes = timeStringToMinutes(slot.startTime);
    const toMinutes = timeStringToMinutes(slot.endTime);
    if (toMinutes > fromMinutes) weeklyClassSeconds += Math.round((toMinutes - fromMinutes) * 60);
  }

  const weeks = range / 7;
  return {
    range,
    selfStudySeconds: Number(self?.seconds ?? 0),
    classSeconds: Math.round(weeklyClassSeconds * weeks),
    weeklyClassSeconds,
    weeks: Math.round(weeks * 10) / 10,
  };
}
