"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import {
  addPhoto,
  archiveDiaryEntry,
  createActivity,
  createMedication,
  createMilestone,
  createTimelineEvent,
  deleteMilestone,
  deletePrayerLog,
  deleteReflection,
  deleteTimelineEvent,
  logMedicationDose,
  logPrayer,
  saveDiaryEntry,
  saveReflection,
  updateActivity,
  updateMedication,
  updatePhoto,
} from "@/server/services/life";
import {
  addPhotoSchema,
  createActivitySchema,
  createMedicationSchema,
  createMilestoneSchema,
  createTimelineSchema,
  logDoseSchema,
  logPrayerSchema,
  saveDiarySchema,
  saveReflectionSchema,
  serializeActivity,
  serializeDiary,
  serializeMedication,
  serializeMilestone,
  serializePhoto,
  serializeReflection,
  serializeTimeline,
  updateActivitySchema,
  updateMedicationSchema,
  updatePhotoSchema,
  type SerializedActivity,
  type SerializedDiaryEntry,
  type SerializedMedication,
  type SerializedMilestone,
  type SerializedPhoto,
  type SerializedReflection,
  type SerializedTimelineEvent,
} from "@/server/services/life-validation";

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate(...paths: string[]) {
  for (const path of paths) revalidatePath(path);
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* -------------------------------- activities ------------------------------- */

export async function createActivityAction(input: unknown): Promise<ActionResult<SerializedActivity>> {
  return safeAction("activity:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createActivitySchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the activity details");

    const startedAt = toDate(parsed.data.startedAt);
    if (!startedAt) return fail("That start time is not valid");
    const endedAt = parsed.data.endedAt ? toDate(parsed.data.endedAt) : null;
    if (parsed.data.endedAt && !endedAt) return fail("That end time is not valid");
    if (endedAt && endedAt <= startedAt) return fail("The end time must be after the start time");

    const activity = await createActivity({ ...parsed.data, userId, startedAt, endedAt });
    revalidate("/life/activities");
    return ok(serializeActivity(activity));
  });
}

export async function updateActivityAction(
  activityId: string,
  input: unknown,
): Promise<ActionResult<SerializedActivity>> {
  return safeAction("activity:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateActivitySchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the activity details");

    const startedAt = parsed.data.startedAt ? toDate(parsed.data.startedAt) : undefined;
    if (parsed.data.startedAt && !startedAt) return fail("That start time is not valid");
    const endedAt = parsed.data.endedAt ? toDate(parsed.data.endedAt) : undefined;
    if (parsed.data.endedAt && !endedAt) return fail("That end time is not valid");

    const updated = await updateActivity(userId, activityId, {
      ...parsed.data,
      startedAt: startedAt ?? undefined,
      endedAt: parsed.data.endedAt === undefined ? undefined : (endedAt ?? null),
    });
    if (!updated) return fail("That activity no longer exists.");
    revalidate("/life/activities");
    return ok(serializeActivity(updated));
  });
}

/* ---------------------------------- prayer --------------------------------- */

export async function logPrayerAction(input: unknown): Promise<ActionResult<{ prayer: string; status: string }>> {
  return safeAction("prayer:log", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = logPrayerSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the prayer entry");

    const log = await logPrayer({ ...parsed.data, userId });
    revalidate("/life/prayer");
    return ok({ prayer: log.prayer, status: log.status });
  });
}

export async function deletePrayerLogAction(logId: string): Promise<ActionResult<{ id: string }>> {
  return safeAction("prayer:delete", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const removed = await deletePrayerLog(userId, logId);
    if (!removed) return fail("That entry no longer exists.");
    revalidate("/life/prayer");
    return ok({ id: logId });
  });
}

/* -------------------------------- medication ------------------------------- */

export async function createMedicationAction(input: unknown): Promise<ActionResult<SerializedMedication>> {
  return safeAction("medication:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createMedicationSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the medication details");

    const medication = await createMedication({ ...parsed.data, userId });
    revalidate("/life/medication");
    return ok(serializeMedication(medication));
  });
}

export async function updateMedicationAction(
  medicationId: string,
  input: unknown,
): Promise<ActionResult<SerializedMedication>> {
  return safeAction("medication:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateMedicationSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the medication details");

    const updated = await updateMedication(userId, medicationId, parsed.data);
    if (!updated) return fail("That medication no longer exists.");
    revalidate("/life/medication");
    return ok(serializeMedication(updated));
  });
}

export async function logDoseAction(input: unknown): Promise<ActionResult<{ medicationId: string; status: string }>> {
  return safeAction("medication:logDose", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = logDoseSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the dose entry");

    const scheduledAt = toDate(parsed.data.scheduledAt);
    if (!scheduledAt) return fail("That scheduled time is not valid");

    const log = await logMedicationDose({ ...parsed.data, userId, scheduledAt });
    if (!log) return fail("That medication no longer exists.");
    revalidate("/life/medication");
    return ok({ medicationId: log.medicationId, status: log.status });
  });
}

/* ---------------------------------- diary ---------------------------------- */

export async function saveDiaryAction(input: unknown): Promise<ActionResult<SerializedDiaryEntry>> {
  return safeAction("diary:save", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = saveDiarySchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the entry");

    const entry = await saveDiaryEntry({ ...parsed.data, userId });
    revalidate("/life/diary");
    return ok(serializeDiary(entry));
  });
}

export async function archiveDiaryAction(entryId: string): Promise<ActionResult<{ id: string }>> {
  return safeAction("diary:archive", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const archived = await archiveDiaryEntry(userId, entryId);
    if (!archived) return fail("That entry no longer exists.");
    revalidate("/life/diary");
    return ok({ id: entryId });
  });
}

/* ---------------------------------- photos --------------------------------- */

export async function addPhotoAction(input: unknown): Promise<ActionResult<SerializedPhoto>> {
  return safeAction("photo:add", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = addPhotoSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the photo details");

    const takenAt = parsed.data.takenAt ? toDate(parsed.data.takenAt) : null;
    if (parsed.data.takenAt && !takenAt) return fail("That date is not valid");

    const photo = await addPhoto({ ...parsed.data, userId, takenAt });
    revalidate("/life/photos");
    return ok(serializePhoto(photo));
  });
}

export async function updatePhotoAction(photoId: string, input: unknown): Promise<ActionResult<SerializedPhoto>> {
  return safeAction("photo:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updatePhotoSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the photo details");

    const takenAt = parsed.data.takenAt ? toDate(parsed.data.takenAt) : undefined;
    const updated = await updatePhoto(userId, photoId, {
      ...parsed.data,
      takenAt: parsed.data.takenAt === undefined ? undefined : (takenAt ?? null),
    });
    if (!updated) return fail("That photo no longer exists.");
    revalidate("/life/photos");
    return ok(serializePhoto(updated));
  });
}

/* --------------------------------- timeline -------------------------------- */

export async function createTimelineAction(input: unknown): Promise<ActionResult<SerializedTimelineEvent>> {
  return safeAction("timeline:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createTimelineSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the timeline entry");

    const event = await createTimelineEvent({ ...parsed.data, userId });
    revalidate("/life/timeline");
    return ok(serializeTimeline(event));
  });
}

export async function deleteTimelineAction(eventId: string): Promise<ActionResult<{ id: string }>> {
  return safeAction("timeline:delete", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const removed = await deleteTimelineEvent(userId, eventId);
    if (!removed) return fail("That entry no longer exists.");
    revalidate("/life/timeline");
    return ok({ id: eventId });
  });
}

/* -------------------------------- milestones ------------------------------- */

export async function createMilestoneAction(input: unknown): Promise<ActionResult<SerializedMilestone>> {
  return safeAction("milestone:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createMilestoneSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the milestone details");

    const milestone = await createMilestone({ ...parsed.data, userId });
    revalidate("/life/timeline");
    return ok(serializeMilestone(milestone));
  });
}

export async function deleteMilestoneAction(milestoneId: string): Promise<ActionResult<{ id: string }>> {
  return safeAction("milestone:delete", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const removed = await deleteMilestone(userId, milestoneId);
    if (!removed) return fail("That milestone no longer exists.");
    revalidate("/life/timeline");
    return ok({ id: milestoneId });
  });
}

/* ----------------------------- monthly reflection -------------------------- */

export async function saveReflectionAction(input: unknown): Promise<ActionResult<SerializedReflection>> {
  return safeAction("reflection:save", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = saveReflectionSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the reflection");

    const reflection = await saveReflection({ ...parsed.data, userId });
    revalidate("/life/timeline");
    return ok(serializeReflection(reflection));
  });
}

export async function deleteReflectionAction(reflectionId: string): Promise<ActionResult<{ id: string }>> {
  return safeAction("reflection:delete", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const removed = await deleteReflection(userId, reflectionId);
    if (!removed) return fail("That reflection no longer exists.");
    revalidate("/life/timeline");
    return ok({ id: reflectionId });
  });
}
