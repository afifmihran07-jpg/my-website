import "server-only";
import { z } from "zod";

import { dateKey, iso, optionalInt, optionalText, requiredText, tagList } from "@/server/services/common-validation";
import { PRAYER_NAMES, PRAYER_STATUS_NAMES } from "@/lib/labels";
import type {
  Activity,
  DiaryEntry,
  Medication,
  Milestone,
  MonthlyReflection,
  Photo,
  TimelineEvent,
} from "@/server/db/schema";

export const prayerName = z.enum(PRAYER_NAMES);
export const prayerStatus = z.enum(PRAYER_STATUS_NAMES);
export const medicationLogStatus = z.enum(["pending", "taken", "skipped", "missed"]);

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");
const dateTime = z.string().trim().min(1, "Pick a date and time");

/* -------------------------------- activities ------------------------------- */

export const activityRecurrence = z.enum(["none", "daily", "weekly", "monthly", "custom"]);

export const createActivitySchema = z.object({
  title: requiredText(200, "Title"),
  kind: optionalText(60, "Kind"),
  startedAt: dateTime,
  endedAt: dateTime.optional().nullable(),
  durationMinutes: optionalInt(0, 24 * 60, "Duration"),
  recurrence: activityRecurrence.default("none"),
  notes: optionalText(4000, "Notes"),
});

export const updateActivitySchema = createActivitySchema.partial().extend({ archived: z.boolean().optional() });

export function serializeActivity(activity: Activity) {
  return {
    id: activity.id,
    title: activity.title,
    kind: activity.kind,
    startedAt: iso(activity.startedAt),
    endedAt: iso(activity.endedAt),
    durationMinutes: activity.durationMinutes,
    recurrence: activity.recurrence,
    notes: activity.notes,
  };
}

export type SerializedActivity = ReturnType<typeof serializeActivity>;

/* ---------------------------------- prayer --------------------------------- */

export const logPrayerSchema = z.object({
  prayer: prayerName,
  day: dateOnly,
  status: prayerStatus,
  notes: optionalText(1000, "Notes"),
});







/* -------------------------------- medication ------------------------------- */

const timeList = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => {
    const raw = Array.isArray(value) ? value : value.split(",");
    const times = raw
      .map((item) => item.trim())
      .filter((item) => /^([01]\d|2[0-3]):[0-5]\d$/.test(item));
    return [...new Set(times)].sort().slice(0, 12);
  })
  .optional();

export const createMedicationSchema = z.object({
  name: requiredText(120, "Medication name"),
  dose: optionalText(80, "Dose"),
  times: timeList,
  schedule: optionalText(200, "Schedule"),
  startDate: dateKey,
  endDate: dateKey,
  active: z.boolean().optional(),
  notes: optionalText(2000, "Notes"),
});

export const updateMedicationSchema = createMedicationSchema.partial();

export const logDoseSchema = z.object({
  medicationId: z.uuid("Choose a medication"),
  scheduledAt: dateTime,
  status: medicationLogStatus,
  notes: optionalText(500, "Notes"),
});

export function serializeMedication(medication: Medication & { takenToday?: number; scheduledToday?: number }) {
  return {
    id: medication.id,
    name: medication.name,
    dose: medication.dose,
    times: medication.times,
    schedule: medication.schedule,
    startDate: medication.startDate,
    endDate: medication.endDate,
    active: medication.active,
    notes: medication.notes,
    takenToday: medication.takenToday ?? 0,
    scheduledToday: medication.scheduledToday ?? 0,
  };
}

export type SerializedMedication = ReturnType<typeof serializeMedication>;

/* ---------------------------------- diary ---------------------------------- */

export const saveDiarySchema = z.object({
  day: dateOnly,
  body: z.string().trim().min(1, "Write something first").max(40_000, "That entry is too long"),
  mood: optionalInt(1, 5, "Mood"),
  tags: tagList,
  aiAllowed: z.boolean().optional(),
});

export function serializeDiary(entry: DiaryEntry) {
  return {
    id: entry.id,
    day: entry.day,
    body: entry.body,
    mood: entry.mood,
    tags: entry.tags,
    aiAllowed: entry.aiAllowed,
    updatedAt: iso(entry.updatedAt),
  };
}

export type SerializedDiaryEntry = ReturnType<typeof serializeDiary>;



/* ---------------------------------- photos --------------------------------- */

export const addPhotoSchema = z.object({
  path: z.string().trim().min(1, "A file path or URL is required").max(2000),
  caption: optionalText(500, "Caption"),
  takenAt: dateTime.optional().nullable(),
  tags: tagList,
  location: optionalText(200, "Location"),
});

export const updatePhotoSchema = z.object({
  caption: optionalText(500, "Caption"),
  tags: tagList,
  location: optionalText(200, "Location"),
  takenAt: dateTime.optional().nullable(),
  archived: z.boolean().optional(),
});

export function serializePhoto(photo: Photo) {
  return {
    id: photo.id,
    path: photo.path,
    caption: photo.caption,
    takenAt: iso(photo.takenAt),
    tags: photo.tags,
    location: photo.location,
    createdAt: iso(photo.createdAt),
  };
}

export type SerializedPhoto = ReturnType<typeof serializePhoto>;

/* --------------------------------- timeline -------------------------------- */

export const timelineKind = z.enum([
  "academic_award",
  "scholarship",
  "certificate",
  "competition",
  "hackathon",
  "research",
  "conference",
  "project",
  "leadership",
  "presentation",
  "publication",
  "milestone",
  "other",
]);

export const createTimelineSchema = z.object({
  title: requiredText(200, "Title"),
  description: optionalText(4000, "Description"),
  occurredOn: dateOnly,
  kind: timelineKind.default("milestone"),
  importance: optionalInt(1, 5, "Importance"),
});

export function serializeTimeline(event: TimelineEvent) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    occurredOn: event.occurredOn,
    kind: event.kind,
    linkedType: event.linkedType,
    linkedId: event.linkedId,
    importance: event.importance,
  };
}

export type SerializedTimelineEvent = ReturnType<typeof serializeTimeline>;

/* -------------------------------- milestones ------------------------------- */

export const createMilestoneSchema = z.object({
  title: requiredText(200, "Title"),
  description: optionalText(4000, "Description"),
  kind: optionalText(60, "Kind"),
  achievedOn: dateOnly,
});

export function serializeMilestone(milestone: Milestone) {
  return {
    id: milestone.id,
    title: milestone.title,
    description: milestone.description,
    kind: milestone.kind,
    achievedOn: milestone.achievedOn,
  };
}

export type SerializedMilestone = ReturnType<typeof serializeMilestone>;

/* ----------------------------- monthly reflection -------------------------- */

export const saveReflectionSchema = z.object({
  periodStart: dateOnly,
  learned: optionalText(8000, "What you learned"),
  accomplished: optionalText(8000, "What you accomplished"),
  struggled: optionalText(8000, "What you struggled with"),
  thinkingChanged: optionalText(8000, "How your thinking changed"),
  proudOf: optionalText(8000, "What you are proud of"),
  stopDoing: optionalText(8000, "What to stop doing"),
  focusNext: optionalText(8000, "What to focus on next"),
});

export function serializeReflection(reflection: MonthlyReflection) {
  return {
    id: reflection.id,
    periodStart: reflection.periodStart,
    learned: reflection.learned,
    accomplished: reflection.accomplished,
    struggled: reflection.struggled,
    thinkingChanged: reflection.thinkingChanged,
    proudOf: reflection.proudOf,
    stopDoing: reflection.stopDoing,
    focusNext: reflection.focusNext,
    updatedAt: iso(reflection.updatedAt),
  };
}

export type SerializedReflection = ReturnType<typeof serializeReflection>;