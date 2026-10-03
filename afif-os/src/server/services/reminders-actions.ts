"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { reminderLogs, users } from "@/server/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import {
  cancelReminder,
  completeReminder,
  createReminder,
  markAllNotificationsRead,
  markNotificationRead,
  runReminderTick,
  type TickResult,
} from "@/server/services/reminders";
import { instantFromLocal, isValidTimeZone } from "@/server/lib/time";
import { createReminderSchema } from "@/server/services/reminder-validation";

const permissionSchema = z.enum(["default", "granted", "denied", "unsupported", "unknown"]);

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

export async function createReminderAction(
  input: unknown,
): Promise<ActionResult<{ id: string; remindAt: string; duplicated: boolean }>> {
  return safeAction("reminder:create", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const parsed = createReminderSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid reminder");

    const timeZone = isValidTimeZone(record.user.timezone) ? record.user.timezone : "Asia/Dhaka";
    const time = parsed.data.time.length === 5 ? `${parsed.data.time}:00` : parsed.data.time;
    // The user types wall-clock time; convert it to the correct UTC instant for
    // their zone so a reminder at 20:00 in Dhaka fires at 20:00 in Dhaka.
    const instant = instantFromLocal(parsed.data.date, time, timeZone);
    if (Number.isNaN(instant.getTime())) return fail("That date and time could not be parsed.");

    const result = await createReminder({
      userId: record.user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      remindAt: instant,
      timeZone,
      recurrence: parsed.data.recurrence,
      priority: parsed.data.priority,
    });

    revalidatePath("/reminders");
    return ok({ id: result.reminder.id, remindAt: result.reminder.remindAt.toISOString(), duplicated: !result.created });
  });
}

export async function completeReminderAction(reminderId: string): Promise<ActionResult<{ done: true }>> {
  return safeAction("reminder:complete", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    await completeReminder(userId, reminderId);
    revalidatePath("/reminders");
    return ok({ done: true });
  });
}

export async function cancelReminderAction(reminderId: string): Promise<ActionResult<{ done: true }>> {
  return safeAction("reminder:cancel", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    await cancelReminder(userId, reminderId);
    revalidatePath("/reminders");
    return ok({ done: true });
  });
}

/** Manual trigger — the same entry point a cron job would call. */
export async function runReminderTickAction(): Promise<ActionResult<TickResult>> {
  return safeAction("reminder:tick", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const result = await runReminderTick();
    revalidatePath("/reminders");
    return ok(result);
  });
}

export async function setNotificationPermissionAction(
  permission: z.infer<typeof permissionSchema>,
): Promise<ActionResult<{ permission: string }>> {
  return safeAction("notification:permission", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const parsed = permissionSchema.safeParse(permission);
    if (!parsed.success) return fail("Unknown permission value");
    await db.update(users).set({ notificationPermission: parsed.data }).where(eq(users.id, record.user.id));
    revalidatePath("/reminders");
    return ok({ permission: parsed.data });
  });
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult<{ done: true }>> {
  return safeAction("notification:read", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    await markNotificationRead(userId, notificationId);
    revalidatePath("/reminders");
    return ok({ done: true });
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ done: true }>> {
  return safeAction("notification:read-all", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    await markAllNotificationsRead(userId);
    revalidatePath("/reminders");
    return ok({ done: true });
  });
}

export async function reminderLogAction(reminderId: string): Promise<ActionResult<Array<{ id: string; event: string; detail: string | null; at: string }>>> {
  return safeAction("reminder:log", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const rows = await db
      .select()
      .from(reminderLogs)
      .where(eq(reminderLogs.reminderId, reminderId))
      .limit(50);
    return ok(
      rows
        .filter((row) => row.userId === record.user.id)
        .map((row) => ({
          id: row.id,
          event: row.event,
          detail: row.detail,
          at: row.createdAt.toISOString(),
        })),
    );
  });
}
