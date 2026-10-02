import "server-only";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  activities,
  diaryEntries,
  medicationLogs,
  medications,
  milestones,
  monthlyReflections,
  photos,
  prayerLogs,
  timelineEvents,
  type Activity,
  type DiaryEntry,
  type Medication,
  type MedicationLog,
  type Milestone,
  type MonthlyReflection,
  type Photo,
  type PrayerLog,
  type TimelineEvent,
} from "@/server/db/schema";

export const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYERS)[number];
export const PRAYER_STATUSES = ["on_time", "late", "missed", "qada"] as const;

/* -------------------------------- activities ------------------------------- */

export async function listActivities(userId: string, limit = 100): Promise<Activity[]> {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, userId), isNull(activities.archivedAt)))
    .orderBy(desc(activities.startedAt))
    .limit(limit);
}

export async function createActivity(input: {
  userId: string;
  title: string;
  kind?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
  durationMinutes?: number | null;
  recurrence?: Activity["recurrence"];
  notes?: string | null;
}): Promise<Activity> {
  // Duration is derived from the two timestamps when both are present, so the
  // stored value can never disagree with the times shown.
  const durationMinutes =
    input.endedAt && input.endedAt > input.startedAt
      ? Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 60_000)
      : (input.durationMinutes ?? null);

  const [row] = await db
    .insert(activities)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      kind: input.kind?.trim() || "general",
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      durationMinutes,
      recurrence: input.recurrence ?? "none",
      notes: input.notes?.trim() || null,
    })
    .returning();
  return row!;
}

export async function updateActivity(
  userId: string,
  activityId: string,
  patch: Partial<{
    title: string;
    kind: string | null;
    startedAt: Date;
    endedAt: Date | null;
    recurrence: Activity["recurrence"];
    notes: string | null;
    archived: boolean;
  }>,
): Promise<Activity | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title.trim();
  if (patch.kind !== undefined) values.kind = patch.kind?.trim() || "general";
  if (patch.startedAt !== undefined) values.startedAt = patch.startedAt;
  if (patch.endedAt !== undefined) values.endedAt = patch.endedAt;
  if (patch.recurrence !== undefined) values.recurrence = patch.recurrence;
  if (patch.notes !== undefined) values.notes = patch.notes?.trim() || null;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  if (patch.startedAt !== undefined || patch.endedAt !== undefined) {
    const [current] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
    const start = patch.startedAt ?? current?.startedAt;
    const end = patch.endedAt !== undefined ? patch.endedAt : (current?.endedAt ?? null);
    values.durationMinutes = start && end && end > start ? Math.round((end.getTime() - start.getTime()) / 60_000) : null;
  }

  const [row] = await db
    .update(activities)
    .set(values)
    .where(and(eq(activities.userId, userId), eq(activities.id, activityId)))
    .returning();
  return row ?? null;
}

export async function activitySummary(userId: string, from: Date, to: Date) {
  const rows = await db
    .select({
      kind: activities.kind,
      count: sql<number>`count(*)`,
      minutes: sql<number>`coalesce(sum(${activities.durationMinutes}), 0)`,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        isNull(activities.archivedAt),
        gte(activities.startedAt, from),
        lte(activities.startedAt, to),
      ),
    )
    .groupBy(activities.kind)
    .orderBy(desc(sql`count(*)`));

  return rows.map((row) => ({ kind: row.kind, count: Number(row.count), minutes: Number(row.minutes) }));
}

/* ---------------------------------- prayer --------------------------------- */

export type PrayerDayRow = {
  prayer: PrayerName;
  status: PrayerLog["status"] | null;
  loggedAt: Date | null;
  id: string | null;
};

/**
 * The grid for one day: one cell per prayer, filled from the log.
 * Missing cells are genuinely missing — they are not inferred or back-filled.
 */
export async function prayerDay(userId: string, day: string): Promise<PrayerDayRow[]> {
  const rows = await db
    .select()
    .from(prayerLogs)
    .where(and(eq(prayerLogs.userId, userId), eq(prayerLogs.day, day)));

  return PRAYERS.map((prayer) => {
    const row = rows.find((item) => item.prayer === prayer);
    return {
      prayer,
      status: row?.status ?? null,
      loggedAt: row?.loggedAt ?? null,
      id: row?.id ?? null,
    };
  });
}

/**
 * Records a prayer. Unique on (user, prayer, day), so logging the same slot
 * twice updates it instead of creating a duplicate.
 */
export async function logPrayer(input: {
  userId: string;
  prayer: PrayerName;
  day: string;
  status: PrayerLog["status"];
  notes?: string | null;
}): Promise<PrayerLog> {
  const [row] = await db
    .insert(prayerLogs)
    .values({
      userId: input.userId,
      prayer: input.prayer,
      day: input.day,
      status: input.status,
      notes: input.notes?.trim() || null,
      loggedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [prayerLogs.userId, prayerLogs.prayer, prayerLogs.day],
      set: { status: input.status, notes: input.notes?.trim() || null, loggedAt: new Date(), updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function deletePrayerLog(userId: string, logId: string): Promise<boolean> {
  const [row] = await db
    .delete(prayerLogs)
    .where(and(eq(prayerLogs.userId, userId), eq(prayerLogs.id, logId)))
    .returning({ id: prayerLogs.id });
  return Boolean(row);
}

/** Streak of consecutive days with all five prayers on time or late (not missed). */
export async function prayerStreak(userId: string, todayKey: string): Promise<{ current: number; longest: number }> {
  const rows = await db
    .select({
      day: prayerLogs.day,
      missed: sql<number>`count(*) filter (where ${prayerLogs.status} = 'missed')`,
      total: sql<number>`count(*)`,
    })
    .from(prayerLogs)
    .where(eq(prayerLogs.userId, userId))
    .groupBy(prayerLogs.day);

  // A day counts as complete when all five are logged and none is missed.
  const complete = new Set(rows.filter((row) => Number(row.total) === 5 && Number(row.missed) === 0).map((row) => row.day));

  const shift = (key: string, delta: number) => {
    const date = new Date(`${key}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
  };

  let current = 0;
  let cursor = todayKey;
  if (!complete.has(cursor)) cursor = shift(cursor, -1);
  while (complete.has(cursor)) {
    current += 1;
    cursor = shift(cursor, -1);
  }

  const days = [...complete].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    run = i > 0 && shift(days[i - 1]!, 1) === days[i] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return { current, longest };
}

export async function prayerStats(userId: string, days = 30) {
  const rows = await db
    .select({ status: sql<string>`${prayerLogs.status}::text`, count: sql<number>`count(*)` })
    .from(prayerLogs)
    .where(and(eq(prayerLogs.userId, userId), sql`${prayerLogs.day} >= (current_date - ${days} * interval '1 day')`))
    .groupBy(prayerLogs.status);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = Number(row.count);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const prayed = (counts.on_time ?? 0) + (counts.late ?? 0) + (counts.qada ?? 0);

  return {
    days,
    total,
    onTime: counts.on_time ?? 0,
    late: counts.late ?? 0,
    missed: counts.missed ?? 0,
    qada: counts.qada ?? 0,
    /** share of logged prayers that were performed — reported as a count too */
    consistency: total > 0 ? Math.round((prayed / total) * 100) : null,
  };
}

/* -------------------------------- medication ------------------------------- */

export type MedicationWithToday = Medication & {
  logs: MedicationLog[];
  takenToday: number;
  scheduledToday: number;
};

/**
 * Builds today's schedule from the medication's configured times.
 *
 * This app tracks whether a dose was taken. It never recommends, adjusts or
 * prescribes anything — the schedule is whatever the user entered.
 */
export async function listMedications(userId: string, dayKey: string): Promise<MedicationWithToday[]> {
  const meds = await db
    .select()
    .from(medications)
    .where(eq(medications.userId, userId))
    .orderBy(medications.name);

  const logs = await db
    .select()
    .from(medicationLogs)
    .where(and(eq(medicationLogs.userId, userId), sql`date(${medicationLogs.scheduledAt}) = ${dayKey}::date`));

  return meds.map((medication) => {
    const own = logs.filter((log) => log.medicationId === medication.id);
    return {
      ...medication,
      logs: own,
      takenToday: own.filter((log) => log.status === "taken").length,
      scheduledToday: medication.active ? medication.times.length : 0,
    };
  });
}

export async function createMedication(input: {
  userId: string;
  name: string;
  dose?: string | null;
  times?: string[];
  schedule?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  active?: boolean;
  notes?: string | null;
}): Promise<Medication> {
  const [row] = await db
    .insert(medications)
    .values({
      userId: input.userId,
      name: input.name.trim(),
      dose: input.dose?.trim() || null,
      times: input.times ?? [],
      schedule: input.schedule?.trim() || null,
      startDate: input.startDate || null,
      endDate: input.endDate || null,
      active: input.active ?? true,
      notes: input.notes?.trim() || null,
    })
    .returning();
  return row!;
}

export async function updateMedication(
  userId: string,
  medicationId: string,
  patch: Partial<{
    name: string;
    dose: string | null;
    times: string[];
    schedule: string | null;
    startDate: string | null;
    endDate: string | null;
    active: boolean;
    notes: string | null;
  }>,
): Promise<Medication | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.dose !== undefined) values.dose = patch.dose?.trim() || null;
  if (patch.times !== undefined) values.times = patch.times;
  if (patch.schedule !== undefined) values.schedule = patch.schedule?.trim() || null;
  if (patch.startDate !== undefined) values.startDate = patch.startDate || null;
  if (patch.endDate !== undefined) values.endDate = patch.endDate || null;
  if (patch.active !== undefined) values.active = patch.active;
  if (patch.notes !== undefined) values.notes = patch.notes?.trim() || null;

  const [row] = await db
    .update(medications)
    .set(values)
    .where(and(eq(medications.userId, userId), eq(medications.id, medicationId)))
    .returning();
  return row ?? null;
}

/**
 * Marks a scheduled dose as taken or skipped.
 *
 * The log row is created on demand and is unique per (medication, scheduledAt),
 * so tapping twice cannot record the dose twice.
 */
export async function logMedicationDose(input: {
  userId: string;
  medicationId: string;
  scheduledAt: Date;
  status: MedicationLog["status"];
  notes?: string | null;
}): Promise<MedicationLog | null> {
  const [owner] = await db
    .select({ id: medications.id })
    .from(medications)
    .where(and(eq(medications.userId, input.userId), eq(medications.id, input.medicationId)))
    .limit(1);
  if (!owner) return null;

  const [row] = await db
    .insert(medicationLogs)
    .values({
      userId: input.userId,
      medicationId: input.medicationId,
      scheduledAt: input.scheduledAt,
      status: input.status,
      takenAt: input.status === "taken" ? new Date() : null,
      notes: input.notes?.trim() || null,
    })
    .onConflictDoUpdate({
      target: [medicationLogs.medicationId, medicationLogs.scheduledAt],
      set: {
        status: input.status,
        takenAt: input.status === "taken" ? new Date() : null,
        notes: input.notes?.trim() || null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row ?? null;
}

export async function medicationAdherence(userId: string, days = 7) {
  const rows = await db
    .select({ status: sql<string>`${medicationLogs.status}::text`, count: sql<number>`count(*)` })
    .from(medicationLogs)
    .where(and(eq(medicationLogs.userId, userId), sql`${medicationLogs.scheduledAt} >= now() - ${days} * interval '1 day'`))
    .groupBy(medicationLogs.status);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = Number(row.count);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return { days, total, taken: counts.taken ?? 0, skipped: counts.skipped ?? 0, missed: counts.missed ?? 0, pending: counts.pending ?? 0 };
}

/* ---------------------------------- diary ---------------------------------- */

export async function listDiary(userId: string, limit = 60): Promise<DiaryEntry[]> {
  return db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.archivedAt)))
    .orderBy(desc(diaryEntries.day))
    .limit(limit);
}

export async function getDiaryEntry(userId: string, day: string): Promise<DiaryEntry | null> {
  const [row] = await db
    .select()
    .from(diaryEntries)
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.day, day)))
    .limit(1);
  return row ?? null;
}

/** One entry per day; writing again on the same day updates it. */
export async function saveDiaryEntry(input: {
  userId: string;
  day: string;
  body: string;
  mood?: number | null;
  tags?: string[];
  aiAllowed?: boolean;
}): Promise<DiaryEntry> {
  const [row] = await db
    .insert(diaryEntries)
    .values({
      userId: input.userId,
      day: input.day,
      body: input.body,
      mood: input.mood ?? null,
      tags: input.tags ?? [],
      aiAllowed: input.aiAllowed ?? false,
    })
    .onConflictDoUpdate({
      target: [diaryEntries.userId, diaryEntries.day],
      set: {
        body: input.body,
        mood: input.mood ?? null,
        tags: input.tags ?? [],
        aiAllowed: input.aiAllowed ?? false,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function archiveDiaryEntry(userId: string, entryId: string): Promise<boolean> {
  const [row] = await db
    .update(diaryEntries)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.id, entryId)))
    .returning({ id: diaryEntries.id });
  return Boolean(row);
}

/* ---------------------------------- photos --------------------------------- */

export async function listPhotos(userId: string, limit = 120): Promise<Photo[]> {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.userId, userId), isNull(photos.archivedAt)))
    .orderBy(desc(photos.takenAt), desc(photos.createdAt))
    .limit(limit);
}

export async function addPhoto(input: {
  userId: string;
  path: string;
  caption?: string | null;
  takenAt?: Date | null;
  tags?: string[];
  location?: string | null;
}): Promise<Photo> {
  const [row] = await db
    .insert(photos)
    .values({
      userId: input.userId,
      path: input.path.trim(),
      caption: input.caption?.trim() || null,
      takenAt: input.takenAt ?? null,
      tags: input.tags ?? [],
      location: input.location?.trim() || null,
    })
    .returning();
  return row!;
}

export async function updatePhoto(
  userId: string,
  photoId: string,
  patch: Partial<{ caption: string | null; tags: string[]; location: string | null; takenAt: Date | null; archived: boolean }>,
): Promise<Photo | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.caption !== undefined) values.caption = patch.caption?.trim() || null;
  if (patch.tags !== undefined) values.tags = patch.tags;
  if (patch.location !== undefined) values.location = patch.location?.trim() || null;
  if (patch.takenAt !== undefined) values.takenAt = patch.takenAt;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  const [row] = await db
    .update(photos)
    .set(values)
    .where(and(eq(photos.userId, userId), eq(photos.id, photoId)))
    .returning();
  return row ?? null;
}

/* --------------------------------- timeline -------------------------------- */

export async function listTimeline(userId: string, limit = 200): Promise<TimelineEvent[]> {
  return db
    .select()
    .from(timelineEvents)
    .where(eq(timelineEvents.userId, userId))
    .orderBy(desc(timelineEvents.occurredOn))
    .limit(limit);
}

export async function createTimelineEvent(input: {
  userId: string;
  title: string;
  description?: string | null;
  occurredOn: string;
  kind?: TimelineEvent["kind"];
  linkedType?: TimelineEvent["linkedType"];
  linkedId?: string | null;
  importance?: number | null;
}): Promise<TimelineEvent> {
  const [row] = await db
    .insert(timelineEvents)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      occurredOn: input.occurredOn,
      kind: input.kind ?? "milestone",
      linkedType: input.linkedType ?? "none",
      linkedId: input.linkedId || null,
      importance: input.importance ?? 1,
    })
    .returning();
  return row!;
}

export async function deleteTimelineEvent(userId: string, eventId: string): Promise<boolean> {
  const [row] = await db
    .delete(timelineEvents)
    .where(and(eq(timelineEvents.userId, userId), eq(timelineEvents.id, eventId)))
    .returning({ id: timelineEvents.id });
  return Boolean(row);
}

/* -------------------------------- milestones ------------------------------- */

export async function listMilestones(userId: string, limit = 100): Promise<Milestone[]> {
  return db
    .select()
    .from(milestones)
    .where(eq(milestones.userId, userId))
    .orderBy(desc(milestones.achievedOn))
    .limit(limit);
}

export async function createMilestone(input: {
  userId: string;
  title: string;
  description?: string | null;
  kind?: string | null;
  achievedOn: string;
  linkedType?: Milestone["linkedType"];
  linkedId?: string | null;
}): Promise<Milestone> {
  const [row] = await db
    .insert(milestones)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      kind: input.kind?.trim() || "personal",
      achievedOn: input.achievedOn,
      linkedType: input.linkedType ?? "none",
      linkedId: input.linkedId || null,
    })
    .returning();
  return row!;
}

export async function deleteMilestone(userId: string, milestoneId: string): Promise<boolean> {
  const [row] = await db
    .delete(milestones)
    .where(and(eq(milestones.userId, userId), eq(milestones.id, milestoneId)))
    .returning({ id: milestones.id });
  return Boolean(row);
}

/* ----------------------------- monthly reflection -------------------------- */

export async function listReflections(userId: string, limit = 24): Promise<MonthlyReflection[]> {
  return db
    .select()
    .from(monthlyReflections)
    .where(eq(monthlyReflections.userId, userId))
    .orderBy(desc(monthlyReflections.periodStart))
    .limit(limit);
}

export async function getReflection(userId: string, periodStart: string): Promise<MonthlyReflection | null> {
  const [row] = await db
    .select()
    .from(monthlyReflections)
    .where(and(eq(monthlyReflections.userId, userId), eq(monthlyReflections.periodStart, periodStart)))
    .limit(1);
  return row ?? null;
}

export const REFLECTION_FIELDS = [
  "learned",
  "accomplished",
  "struggled",
  "thinkingChanged",
  "proudOf",
  "stopDoing",
  "focusNext",
] as const;

export type ReflectionField = (typeof REFLECTION_FIELDS)[number];

/** One reflection per month; saving again updates the same row. */
export async function saveReflection(
  input: { userId: string; periodStart: string } & Partial<Record<ReflectionField, string | null>>,
): Promise<MonthlyReflection> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  for (const field of REFLECTION_FIELDS) {
    if (input[field] !== undefined) values[field] = input[field]?.trim() || null;
  }

  const [row] = await db
    .insert(monthlyReflections)
    .values({ userId: input.userId, periodStart: input.periodStart, ...values })
    .onConflictDoUpdate({ target: [monthlyReflections.userId, monthlyReflections.periodStart], set: values })
    .returning();
  return row!;
}

export async function deleteReflection(userId: string, reflectionId: string): Promise<boolean> {
  const [row] = await db
    .delete(monthlyReflections)
    .where(and(eq(monthlyReflections.userId, userId), eq(monthlyReflections.id, reflectionId)))
    .returning({ id: monthlyReflections.id });
  return Boolean(row);
}

/* ---------------------------------- summary -------------------------------- */

export async function lifeSummary(userId: string, todayKey: string) {
  const [prayerRows, activityRow, medicationRow, diaryRow, photoRow, milestoneRow] = await Promise.all([
    db
      .select({ logged: sql<number>`count(*)`, missed: sql<number>`count(*) filter (where ${prayerLogs.status} = 'missed')` })
      .from(prayerLogs)
      .where(and(eq(prayerLogs.userId, userId), eq(prayerLogs.day, todayKey))),
    db
      .select({ count: sql<number>`count(*)`, minutes: sql<number>`coalesce(sum(${activities.durationMinutes}), 0)` })
      .from(activities)
      .where(and(eq(activities.userId, userId), isNull(activities.archivedAt), sql`${activities.startedAt} >= now() - interval '7 days'`)),
    db
      .select({ active: sql<number>`count(*) filter (where ${medications.active})`, total: sql<number>`count(*)` })
      .from(medications)
      .where(eq(medications.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.archivedAt))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(and(eq(photos.userId, userId), isNull(photos.archivedAt))),
    db.select({ count: sql<number>`count(*)` }).from(milestones).where(eq(milestones.userId, userId)),
  ]);

  return {
    prayersLoggedToday: Number(prayerRows[0]?.logged ?? 0),
    prayersMissedToday: Number(prayerRows[0]?.missed ?? 0),
    activitiesThisWeek: Number(activityRow[0]?.count ?? 0),
    activityMinutesThisWeek: Number(activityRow[0]?.minutes ?? 0),
    activeMedications: Number(medicationRow[0]?.active ?? 0),
    totalMedications: Number(medicationRow[0]?.total ?? 0),
    diaryEntries: Number(diaryRow[0]?.count ?? 0),
    photos: Number(photoRow[0]?.count ?? 0),
    milestones: Number(milestoneRow[0]?.count ?? 0),
  };
}

/** Medications due today with their scheduled times, for the Today view. */
export async function dosesDueToday(userId: string, dayKey: string) {
  const meds = await db
    .select()
    .from(medications)
    .where(and(eq(medications.userId, userId), eq(medications.active, true)));

  const logs = await db
    .select()
    .from(medicationLogs)
    .where(and(eq(medicationLogs.userId, userId), sql`date(${medicationLogs.scheduledAt}) = ${dayKey}::date`));

  const due: { medicationId: string; name: string; dose: string | null; time: string; scheduledAt: Date; status: MedicationLog["status"] }[] = [];

  for (const medication of meds) {
    for (const time of medication.times) {
      const scheduledAt = new Date(`${dayKey}T${time}:00`);
      if (Number.isNaN(scheduledAt.getTime())) continue;
      const log = logs.find((item) => item.medicationId === medication.id && item.scheduledAt.getTime() === scheduledAt.getTime());
      due.push({
        medicationId: medication.id,
        name: medication.name,
        dose: medication.dose,
        time,
        scheduledAt,
        status: log?.status ?? "pending",
      });
    }
  }

  return due.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}
