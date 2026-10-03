import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  books,
  calendarEvents,
  classSchedules,
  courses,
  projects,
  studySessions,
  type StudySession,
} from "@/server/db/schema";
import {
  dayRange,
  instantFromLocal,
  localHour,
  localMinute,
  monthRange,
  shiftDayKey,
  timeStringToMinutes,
  toLocalDayKey,
  weekRange,
} from "@/server/lib/time";

/**
 * Self-study engine.
 *
 * Invariants enforced here (and nowhere else):
 *  - a user has at most ONE running (active|paused) session;
 *  - duration is always computed server-side from stored instants (§34) — the
 *    browser never dictates how long a session lasted;
 *  - `clientKey` makes Start idempotent, so a double-tap or a retried request
 *    cannot create two sessions;
 *  - stopping is a single conditional UPDATE … RETURNING, so two concurrent
 *    "Stop & Save" presses cannot both produce a session;
 *  - nothing is ever hard-deleted — a session is marked `discarded`.
 */

const RUNNING = ["active", "paused"] as const;

/**
 * If a tab stopped heart-beating, the session is capped at the last heartbeat
 * plus this grace period so an abandoned timer cannot inflate study hours.
 */
const HEARTBEAT_GRACE_MS = 45 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 60_000;

export type StudySessionWithLinks = StudySession & {
  courseCode: string | null;
  courseName: string | null;
  courseColor: string | null;
  bookTitle: string | null;
  projectName: string | null;
};

const selectWithLinks = () =>
  db
    .select({
      session: studySessions,
      courseCode: courses.code,
      courseName: courses.name,
      courseColor: courses.color,
      bookTitle: books.title,
      projectName: projects.name,
    })
    .from(studySessions)
    .leftJoin(courses, eq(courses.id, studySessions.courseId))
    .leftJoin(books, eq(books.id, studySessions.bookId))
    .leftJoin(projects, eq(projects.id, studySessions.projectId));

function flatten(row: {
  session: StudySession;
  courseCode: string | null;
  courseName: string | null;
  courseColor: string | null;
  bookTitle: string | null;
  projectName: string | null;
}): StudySessionWithLinks {
  return {
    ...row.session,
    courseCode: row.courseCode,
    courseName: row.courseName,
    courseColor: row.courseColor,
    bookTitle: row.bookTitle,
    projectName: row.projectName,
  };
}

export class StudyError extends Error {
  constructor(
    message: string,
    readonly code: "already_running" | "not_running" | "invalid" = "invalid",
  ) {
    super(message);
    this.name = "StudyError";
  }
}

/** Seconds actually banked so far, including the in-flight interval. */
export function elapsedSeconds(session: StudySession, now = new Date()): number {
  const banked = session.accumulatedSeconds ?? 0;
  if (session.status !== "active" || !session.runningSince) return Math.max(0, banked);
  const running = Math.floor((now.getTime() - session.runningSince.getTime()) / 1000);
  return Math.max(0, banked + Math.max(0, running));
}

export async function getRunningStudy(userId: string): Promise<StudySessionWithLinks | null> {
  const rows = await selectWithLinks()
    .where(and(eq(studySessions.userId, userId), inArray(studySessions.status, [...RUNNING])))
    .orderBy(desc(studySessions.startedAt))
    .limit(1);
  return rows[0] ? flatten(rows[0]) : null;
}

export type StartStudyInput = {
  userId: string;
  title: string;
  courseId?: string | null;
  topic?: string | null;
  bookId?: string | null;
  projectId?: string | null;
  plannedMinutes?: number | null;
  clientKey?: string | null;
};

export async function startStudy(input: StartStudyInput): Promise<StudySessionWithLinks> {
  const title = input.title.trim();
  if (title.length < 2) throw new StudyError("Give the session a title — what are you studying?", "invalid");

  const clientKey = input.clientKey?.trim() || `start-${crypto.randomUUID()}`;

  // Idempotency: the same clientKey always resolves to the same session.
  const [existing] = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, input.userId), eq(studySessions.clientKey, clientKey)))
    .limit(1);
  if (existing) {
    const linked = await selectWithLinks().where(eq(studySessions.id, existing.id)).limit(1);
    if (linked[0]) return flatten(linked[0]);
  }

  const running = await getRunningStudy(input.userId);
  if (running) {
    throw new StudyError("A study session is already running. Stop or discard it before starting a new one.", "already_running");
  }

  const now = new Date();
  try {
    await db.insert(studySessions).values({
      userId: input.userId,
      title,
      courseId: input.courseId ?? null,
      topic: input.topic?.trim() || null,
      bookId: input.bookId ?? null,
      projectId: input.projectId ?? null,
      plannedMinutes: input.plannedMinutes ?? null,
      startedAt: now,
      runningSince: now,
      accumulatedSeconds: 0,
      durationSeconds: 0,
      status: "active",
      lastHeartbeatAt: now,
      clientKey,
    });
  } catch (error) {
    // Lost a race against a concurrent start with the same key — return theirs.
    if (isUniqueViolation(error)) {
      const [row] = await selectWithLinks()
        .where(and(eq(studySessions.userId, input.userId), eq(studySessions.clientKey, clientKey)))
        .limit(1);
      if (row) return flatten(row);
    }
    throw error;
  }

  const created = await selectWithLinks()
    .where(and(eq(studySessions.userId, input.userId), eq(studySessions.clientKey, clientKey)))
    .limit(1);
  if (!created[0]) throw new StudyError("Could not start the session. Please try again.");
  return flatten(created[0]);
}

export async function pauseStudy(userId: string): Promise<StudySessionWithLinks> {
  const now = new Date();
  const updated = await db
    .update(studySessions)
    .set({
      status: "paused",
      pausedAt: now,
      accumulatedSeconds: sql`${studySessions.accumulatedSeconds} + greatest(0, floor(extract(epoch from (${now.toISOString()}::timestamptz - coalesce(${studySessions.runningSince}, ${studySessions.startedAt}))))::int)`,
      runningSince: null,
      lastHeartbeatAt: now,
    })
    .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "active")))
    .returning();

  if (updated.length === 0) throw new StudyError("There is no running session to pause.", "not_running");
  const [row] = await selectWithLinks().where(eq(studySessions.id, updated[0]!.id)).limit(1);
  return flatten(row!);
}

export async function resumeStudy(userId: string): Promise<StudySessionWithLinks> {
  const now = new Date();
  const updated = await db
    .update(studySessions)
    .set({ status: "active", runningSince: now, pausedAt: null, lastHeartbeatAt: now })
    .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "paused")))
    .returning();

  if (updated.length === 0) throw new StudyError("There is no paused session to resume.", "not_running");
  const [row] = await selectWithLinks().where(eq(studySessions.id, updated[0]!.id)).limit(1);
  return flatten(row!);
}

export type StopStudyInput = { userId: string; notes?: string | null };

/**
 * Stop & Save — one atomic, server-timed write (§8, §34).
 * If nothing is running we return the most recent completed session so a
 * double submission is a no-op rather than an error.
 */
export async function stopStudy(
  input: StopStudyInput,
): Promise<{ session: StudySessionWithLinks; alreadySaved: boolean }> {
  const now = new Date();
  const graceSeconds = Math.round(HEARTBEAT_GRACE_MS / 1000);
  // Cap the end at the last heartbeat + grace so an abandoned timer (closed
  // laptop, dead tab) cannot silently inflate the recorded study hours.
  const cap = sql`least(
    ${now.toISOString()}::timestamptz,
    coalesce(${studySessions.lastHeartbeatAt} + (${graceSeconds} * interval '1 second'), ${now.toISOString()}::timestamptz)
  )`;

  const updated = await db
    .update(studySessions)
    .set({
      status: "completed",
      endedAt: sql`${cap}`,
      runningSince: null,
      lastHeartbeatAt: sql`coalesce(${studySessions.lastHeartbeatAt}, ${now.toISOString()}::timestamptz)`,
      durationSeconds: sql`${studySessions.accumulatedSeconds} + case when ${studySessions.status} = 'active' and ${studySessions.runningSince} is not null then greatest(0, floor(extract(epoch from (${cap} - ${studySessions.runningSince}))))::int else 0 end`,
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    })
    .where(and(eq(studySessions.userId, input.userId), inArray(studySessions.status, [...RUNNING])))
    .returning();

  if (updated.length > 0) {
    const [row] = await selectWithLinks().where(eq(studySessions.id, updated[0]!.id)).limit(1);
    return { session: flatten(row!), alreadySaved: false };
  }

  const [recent] = await selectWithLinks()
    .where(and(eq(studySessions.userId, input.userId), eq(studySessions.status, "completed")))
    .orderBy(desc(studySessions.startedAt))
    .limit(1);
  if (!recent) throw new StudyError("There is no study session to save.", "not_running");
  return { session: flatten(recent), alreadySaved: true };
}

export async function discardStudy(userId: string, reason?: string): Promise<void> {
  const now = new Date();
  await db
    .update(studySessions)
    .set({
      status: "discarded",
      endedAt: now,
      runningSince: null,
      notes: reason ? `${reason}` : undefined,
    })
    .where(and(eq(studySessions.userId, userId), inArray(studySessions.status, [...RUNNING])));
}

export async function heartbeat(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(studySessions)
    .set({ lastHeartbeatAt: now })
    .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "active")));
}

/* ------------------------------------------------------------------ */
/* history + analytics                                                 */
/* ------------------------------------------------------------------ */

export async function listSessionsBetween(userId: string, start: Date, end: Date): Promise<StudySessionWithLinks[]> {
  const rows = await selectWithLinks()
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.status, "completed"),
        gte(studySessions.startedAt, start),
        lt(studySessions.startedAt, end),
      ),
    )
    .orderBy(asc(studySessions.startedAt));
  return rows.map(flatten);
}

export type CourseSlice = {
  label: string;
  seconds: number;
  sessions: number;
  color: string | null;
  courseId: string | null;
};

export type DaySummary = {
  dayKey: string;
  sessions: StudySessionWithLinks[];
  totalSeconds: number;
  sessionCount: number;
  averageSeconds: number;
  longestSeconds: number;
  byCourse: CourseSlice[];
  universitySeconds: number;
  totalAcademicSeconds: number;
};

export async function getDaySummary(userId: string, dayKey: string, timeZone: string): Promise<DaySummary> {
  const range = dayRange(dayKey, timeZone);
  const sessions = await listSessionsBetween(userId, range.start, range.end);
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const byCourse = groupByCourse(sessions);
  const universitySeconds = await universitySecondsForDay(userId, dayKey, timeZone);

  return {
    dayKey,
    sessions,
    totalSeconds,
    sessionCount: sessions.length,
    averageSeconds: sessions.length ? Math.round(totalSeconds / sessions.length) : 0,
    longestSeconds: sessions.reduce((max, s) => Math.max(max, s.durationSeconds), 0),
    byCourse,
    universitySeconds,
    totalAcademicSeconds: totalSeconds + universitySeconds,
  };
}

export function groupByCourse(sessions: StudySessionWithLinks[]): CourseSlice[] {
  const map = new Map<string, CourseSlice>();
  for (const session of sessions) {
    const key = session.courseId ?? session.bookId ?? session.projectId ?? session.title.toLowerCase();
    const label = session.courseCode
      ? `${session.courseCode}${session.topic ? ` — ${session.topic}` : ""}`
      : session.topic || session.bookTitle || session.projectName || session.title;
    const existing = map.get(key);
    if (existing) {
      existing.seconds += session.durationSeconds;
      existing.sessions += 1;
    } else {
      map.set(key, {
        label,
        seconds: session.durationSeconds,
        sessions: 1,
        color: session.courseColor,
        courseId: session.courseId,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds);
}

export type WeekSummary = {
  dayKeys: string[];
  totalSeconds: number;
  averageSecondsPerDay: number;
  activeDays: number;
  sessionCount: number;
  longestSeconds: number;
  byCourse: CourseSlice[];
  perDay: Array<{ dayKey: string; seconds: number; sessions: number }>;
};

export async function getWeekSummary(
  userId: string,
  dayKey: string,
  timeZone: string,
  weekStartsOn = 6,
): Promise<WeekSummary> {
  const range = weekRange(dayKey, timeZone, weekStartsOn);
  const sessions = await listSessionsBetween(userId, range.start, range.end);

  const perDay = range.dayKeys.map((key) => {
    const day = dayRange(key, timeZone);
    const daySessions = sessions.filter((s) => s.startedAt >= day.start && s.startedAt < day.end);
    return {
      dayKey: key,
      seconds: daySessions.reduce((sum, s) => sum + s.durationSeconds, 0),
      sessions: daySessions.length,
    };
  });

  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);

  return {
    dayKeys: range.dayKeys,
    totalSeconds,
    averageSecondsPerDay: Math.round(totalSeconds / 7),
    activeDays: perDay.filter((d) => d.seconds > 0).length,
    sessionCount: sessions.length,
    longestSeconds: sessions.reduce((max, s) => Math.max(max, s.durationSeconds), 0),
    byCourse: groupByCourse(sessions),
    perDay,
  };
}

export type MonthSummary = {
  totalSeconds: number;
  sessionCount: number;
  activeDays: number;
  byCourse: CourseSlice[];
  weeklyTotals: Array<{ weekStart: string; seconds: number }>;
};

export async function getMonthSummary(userId: string, dayKey: string, timeZone: string): Promise<MonthSummary> {
  const range = monthRange(dayKey, timeZone);
  const sessions = await listSessionsBetween(userId, range.start, range.end);

  const days = new Set<string>();
  for (const session of sessions) days.add(toLocalDayKey(session.startedAt, timeZone));

  const weekly: Array<{ weekStart: string; seconds: number }> = [];
  let cursor = range.first;
  while (cursor < range.last) {
    const week = weekRange(cursor, timeZone, 6);
    const seconds = sessions
      .filter((s) => s.startedAt >= week.start && s.startedAt < week.end)
      .reduce((sum, s) => sum + s.durationSeconds, 0);
    weekly.push({ weekStart: week.dayKeys[0] ?? cursor, seconds });
    cursor = shiftDayKey(cursor, 7);
  }

  return {
    totalSeconds: sessions.reduce((sum, s) => sum + s.durationSeconds, 0),
    sessionCount: sessions.length,
    activeDays: days.size,
    byCourse: groupByCourse(sessions),
    weeklyTotals: weekly,
  };
}

/* ------------------------------------------------------------------ */
/* 24-hour timeline (§10)                                              */
/* ------------------------------------------------------------------ */

export type TimelineSegment = {
  sessionId: string;
  label: string;
  color: string | null;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  seconds: number;
};

export async function getTimeline(userId: string, dayKey: string, timeZone: string): Promise<TimelineSegment[]> {
  const range = dayRange(dayKey, timeZone);
  const sessions = await listSessionsBetween(userId, range.start, range.end);

  return sessions.flatMap((session) => {
    const start = session.startedAt;
    const end = session.endedAt ?? start;
    const segments: TimelineSegment[] = [];
    let cursor = start;

    // Split at local midnight so an overnight session renders on both days.
    while (cursor < end) {
      const cursorKey = toLocalDayKey(cursor, timeZone);
      const nextMidnight = instantFromLocal(
        toLocalDayKey(new Date(cursor.getTime() + 86_400_000), timeZone),
        "00:00:00",
        timeZone,
      );
      const segmentEnd = end < nextMidnight ? end : nextMidnight;
      if (cursorKey !== dayKey) {
        cursor = segmentEnd;
        continue;
      }
      const seconds = Math.max(0, Math.floor((segmentEnd.getTime() - cursor.getTime()) / 1000));
      if (seconds > 0) {
        segments.push({
          sessionId: session.id,
          label: session.courseCode ?? session.topic ?? session.bookTitle ?? session.projectName ?? session.title,
          color: session.courseColor,
          startHour: localHour(cursor, timeZone),
          startMinute: localMinute(cursor, timeZone),
          endHour: localHour(segmentEnd, timeZone),
          endMinute: localMinute(segmentEnd, timeZone),
          seconds,
        });
      }
      cursor = segmentEnd;
    }
    return segments;
  });
}

/* ------------------------------------------------------------------ */
/* university time — always separate from self-study (§8, §9)          */
/* ------------------------------------------------------------------ */

export async function universitySecondsForDay(userId: string, dayKey: string, timeZone: string): Promise<number> {
  const range = dayRange(dayKey, timeZone);
  const weekday = new Date(`${dayKey}T00:00:00Z`).getUTCDay();

  const scheduled = await db
    .select({ startTime: classSchedules.startTime, endTime: classSchedules.endTime })
    .from(classSchedules)
    .innerJoin(courses, eq(courses.id, classSchedules.courseId))
    .where(
      and(
        eq(classSchedules.userId, userId),
        eq(classSchedules.dayOfWeek, weekday),
        eq(classSchedules.active, true),
        or(sql`${courses.archivedAt} is null`, sql`${courses.status} = 'active'`),
      ),
    );

  let seconds = 0;
  for (const slot of scheduled) {
    const from = timeStringToMinutes(slot.startTime);
    const to = timeStringToMinutes(slot.endTime);
    if (to > from) seconds += Math.round((to - from) * 60);
  }

  const [extra] = await db
    .select({ total: sql<number>`coalesce(sum(extract(epoch from (${calendarEvents.endsAt} - ${calendarEvents.startsAt}))), 0)` })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        eq(calendarEvents.kind, "class"),
        gte(calendarEvents.startsAt, range.start),
        lt(calendarEvents.startsAt, range.end),
      ),
    );

  return seconds + Math.round(Number(extra?.total ?? 0));
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/* ------------------------------------------------------------------ */
/* wire format                                                         */
/* ------------------------------------------------------------------ */

/**
 * JSON-safe projection handed to the client. Dates become ISO strings and the
 * server clock is included so the browser can render a ticking timer without
 * trusting its own clock (and without drifting after a sleep/resume).
 */
export type StudyDto = {
  id: string;
  title: string;
  status: StudySession["status"];
  startedAt: string;
  runningSince: string | null;
  pausedAt: string | null;
  accumulatedSeconds: number;
  durationSeconds: number;
  plannedMinutes: number | null;
  topic: string | null;
  notes: string | null;
  courseId: string | null;
  courseCode: string | null;
  courseName: string | null;
  courseColor: string | null;
  bookTitle: string | null;
  projectName: string | null;
  serverNow: string;
};

export function toStudyDto(session: StudySessionWithLinks, now = new Date()): StudyDto {
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    runningSince: session.runningSince?.toISOString() ?? null,
    pausedAt: session.pausedAt?.toISOString() ?? null,
    accumulatedSeconds: session.accumulatedSeconds,
    durationSeconds: session.durationSeconds,
    plannedMinutes: session.plannedMinutes,
    topic: session.topic,
    notes: session.notes,
    courseId: session.courseId,
    courseCode: session.courseCode,
    courseName: session.courseName,
    courseColor: session.courseColor,
    bookTitle: session.bookTitle,
    projectName: session.projectName,
    serverNow: now.toISOString(),
  };
}
