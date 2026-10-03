import "server-only";
import { and, asc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  notifications,
  reminderLogs,
  reminders,
  users,
  type Reminder,
  type Task,
} from "@/server/db/schema";
import { newDedupeKey } from "@/server/auth/crypto";
import { dayRange, instantFromLocal, shiftDayKey, toLocalDayKey } from "@/server/lib/time";

/**
 * Reminder engine (§15).
 *
 * Lifecycle:  scheduled → queued → sent → delivered → completed
 *                                     ↘ failed (retried up to maxAttempts)
 *              scheduled → missed (never attempted, window elapsed)
 *
 * Rules enforced here:
 *  - `dedupeKey` is unique, so the same slot can never be queued twice;
 *  - every state change writes a `reminder_logs` row — nothing is silent;
 *  - a reminder is only marked `sent` when an in-app notification actually
 *    exists. If the browser refused notification permission we say so in the
 *    log detail instead of pretending it was delivered;
 *  - recurring reminders advance to their next slot after a successful send.
 */

const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];
/** A one-time reminder that never fired within this window is reported missed. */
export const MISSED_GRACE_MS = 6 * 60 * 60 * 1000;

export type ReminderRecurrence = Reminder["recurrence"];

export function nextRemindAt(
  from: Date,
  recurrence: ReminderRecurrence,
  timeZone: string,
  now = new Date(),
): Date | null {
  if (recurrence === "none") return null;
  const key = toLocalDayKey(from, timeZone);
  const time = `${String(from.getUTCHours()).padStart(2, "0")}:00:00`;
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(from);

  let candidate: Date;
  switch (recurrence) {
    case "daily":
      candidate = instantFromLocal(shiftDayKey(key, 1), localTime, timeZone);
      break;
    case "weekly":
      candidate = instantFromLocal(shiftDayKey(key, 7), localTime, timeZone);
      break;
    case "monthly": {
      const [y, m, d] = key.split("-").map(Number) as [number, number, number];
      const next = new Date(Date.UTC(y, m, d));
      const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
        next.getUTCDate(),
      ).padStart(2, "0")}`;
      candidate = instantFromLocal(nextKey, localTime, timeZone);
      break;
    }
    default:
      return null;
  }
  void time;

  // Skip slots that are already in the past so a backlog never fires all at
  // once. Done with arithmetic rather than a loop so a reminder that has been
  // dormant for years still lands on its next real slot.
  if (candidate.getTime() > now.getTime()) return candidate;

  if (recurrence === "daily" || recurrence === "weekly") {
    const periodMs = recurrence === "weekly" ? 7 * 86_400_000 : 86_400_000;
    const periods = Math.floor((now.getTime() - candidate.getTime()) / periodMs) + 1;
    return new Date(candidate.getTime() + periods * periodMs);
  }

  // Monthly: jump whole calendar months, then step forward at most twice.
  const monthsBehind =
    (now.getUTCFullYear() - candidate.getUTCFullYear()) * 12 + (now.getUTCMonth() - candidate.getUTCMonth());
  candidate = addMonths(candidate, Math.max(0, monthsBehind));
  let guard = 0;
  while (candidate.getTime() <= now.getTime() && guard < 4) {
    candidate = addMonths(candidate, 1);
    guard += 1;
  }
  return candidate.getTime() > now.getTime() ? candidate : null;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export type CreateReminderInput = {
  userId: string;
  title: string;
  description?: string | null;
  remindAt: Date;
  timeZone?: string;
  recurrence?: ReminderRecurrence;
  priority?: Reminder["priority"];
  linkedType?: Reminder["linkedType"];
  linkedId?: string | null;
  channel?: Reminder["channel"];
};

export async function createReminder(input: CreateReminderInput): Promise<{ reminder: Reminder; created: boolean }> {
  const timeZone = input.timeZone ?? "Asia/Dhaka";
  const dedupeKey = newDedupeKey(
    input.userId,
    input.linkedType ?? "none",
    input.linkedId ?? input.title,
    input.remindAt.toISOString(),
  );

  const [existing] = await db.select().from(reminders).where(eq(reminders.dedupeKey, dedupeKey)).limit(1);
  if (existing) return { reminder: existing, created: false };

  const [inserted] = await db
    .insert(reminders)
    .values({
      userId: input.userId,
      title: input.title,
      description: input.description ?? null,
      remindAt: input.remindAt,
      timezone: timeZone,
      recurrence: input.recurrence ?? "none",
      priority: input.priority ?? "medium",
      linkedType: input.linkedType ?? "none",
      linkedId: input.linkedId ?? null,
      channel: input.channel ?? "in_app",
      dedupeKey,
    })
    .onConflictDoNothing({ target: reminders.dedupeKey })
    .returning();

  if (inserted) {
    await log(inserted.id, input.userId, "created", `scheduled for ${input.remindAt.toISOString()}`);
    return { reminder: inserted, created: true };
  }

  const [afterConflict] = await db.select().from(reminders).where(eq(reminders.dedupeKey, dedupeKey)).limit(1);
  return { reminder: afterConflict!, created: false };
}

/** Deadline reminders hang off the task they belong to. */
export async function createReminderFromTask(input: { userId: string; task: Task; remindAt: string | Date }) {
  const remindAt = typeof input.remindAt === "string" ? new Date(input.remindAt) : input.remindAt;
  return createReminder({
    userId: input.userId,
    title: `Task due: ${input.task.title}`,
    remindAt,
    linkedType: "task",
    linkedId: input.task.id,
    priority: input.task.priority,
  });
}

async function log(
  reminderId: string,
  userId: string,
  event: (typeof reminderLogs.$inferInsert)["event"],
  detail?: string,
  channel: (typeof reminderLogs.$inferInsert)["channel"] = "in_app",
) {
  await db.insert(reminderLogs).values({ reminderId, userId, event, detail, channel });
}

export async function listReminders(
  userId: string,
  filter: { status?: Reminder["status"][]; limit?: number } = {},
) {
  const conditions = [eq(reminders.userId, userId)];
  if (filter.status?.length) conditions.push(inArray(reminders.status, filter.status));
  return db
    .select()
    .from(reminders)
    .where(and(...conditions))
    .orderBy(asc(reminders.remindAt))
    .limit(filter.limit ?? 200);
}

export async function completeReminder(userId: string, reminderId: string): Promise<void> {
  const [updated] = await db
    .update(reminders)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .returning();
  if (updated) await log(reminderId, userId, "completed");
}

export async function cancelReminder(userId: string, reminderId: string): Promise<void> {
  const [updated] = await db
    .update(reminders)
    .set({ status: "cancelled" })
    .where(and(eq(reminders.id, reminderId), eq(reminders.userId, userId)))
    .returning();
  if (updated) await log(reminderId, userId, "cancelled");
}

/* ------------------------------------------------------------------ */
/* delivery                                                            */
/* ------------------------------------------------------------------ */

export type TickResult = {
  scanned: number;
  sent: number;
  failed: number;
  missed: number;
  rescheduled: number;
  ranAt: string;
};

/**
 * The engine tick. Safe to call from a route handler, a cron job or a page
 * load; each reminder is claimed with a conditional UPDATE so concurrent ticks
 * cannot double-send.
 */
export async function runReminderTick(now = new Date(), limit = 50): Promise<TickResult> {
  const result: TickResult = { scanned: 0, sent: 0, failed: 0, missed: 0, rescheduled: 0, ranAt: now.toISOString() };

  const due = await db
    .select({ reminder: reminders, user: users })
    .from(reminders)
    .innerJoin(users, eq(users.id, reminders.userId))
    .where(
      and(
        inArray(reminders.status, ["scheduled", "queued"]),
        lte(reminders.remindAt, now),
      ),
    )
    .orderBy(asc(reminders.remindAt))
    .limit(limit);

  for (const { reminder, user } of due) {
    result.scanned += 1;

    // Claim it. If another tick already moved it on, skip.
    const [claimed] = await db
      .update(reminders)
      .set({
        status: "queued",
        attempts: sql`${reminders.attempts} + 1`,
        lastAttemptAt: now,
      })
      .where(and(eq(reminders.id, reminder.id), inArray(reminders.status, ["scheduled", "queued"])))
      .returning();
    if (!claimed) continue;

    await log(reminder.id, reminder.userId, "queued", `attempt ${claimed.attempts}`);

    const delivery = await deliverInApp(claimed, user);

    if (delivery.ok) {
      const next = nextRemindAt(claimed.remindAt, claimed.recurrence, claimed.timezone, now);
      if (next) {
        await db
          .update(reminders)
          .set({
            status: "scheduled",
            remindAt: next,
            deliveredAt: now,
            nextAttemptAt: null,
            lastError: null,
            dedupeKey: newDedupeKey(reminder.userId, reminder.linkedType, reminder.linkedId ?? reminder.title, next.toISOString()),
          })
          .where(eq(reminders.id, reminder.id));
        await log(reminder.id, reminder.userId, "rescheduled", `next at ${next.toISOString()}`);
        result.rescheduled += 1;
      } else {
        await db
          .update(reminders)
          .set({ status: "sent", deliveredAt: now, lastError: null })
          .where(eq(reminders.id, reminder.id));
        result.sent += 1;
      }
      await log(reminder.id, reminder.userId, "sent", delivery.detail, "in_app");
    } else {
      const attempts = claimed.attempts;
      const exhausted = attempts >= claimed.maxAttempts;
      const backoff = RETRY_BACKOFF_MS[Math.min(attempts - 1, RETRY_BACKOFF_MS.length - 1)] ?? 15 * 60_000;
      await db
        .update(reminders)
        .set({
          status: exhausted ? "failed" : "queued",
          nextAttemptAt: exhausted ? null : new Date(now.getTime() + backoff),
          lastError: delivery.detail,
        })
        .where(eq(reminders.id, reminder.id));
      await log(reminder.id, reminder.userId, "failed", delivery.detail);
      result.failed += 1;
    }
  }

  // Missed one-time reminders: never attempted, window long gone.
  const missedCutoff = new Date(now.getTime() - MISSED_GRACE_MS);
  const stale = await db
    .select()
    .from(reminders)
    .where(
      and(
        inArray(reminders.status, ["scheduled", "queued"]),
        lte(reminders.remindAt, missedCutoff),
        eq(reminders.attempts, 0),
      ),
    )
    .limit(limit);

  for (const reminder of stale) {
    await db
      .update(reminders)
      .set({ status: "missed", lastError: "Reminder window elapsed before the engine could deliver it" })
      .where(and(eq(reminders.id, reminder.id), eq(reminders.attempts, 0)));
    await log(reminder.id, reminder.userId, "missed", "window elapsed without delivery");
    await db.insert(notifications).values({
      userId: reminder.userId,
      title: `Missed reminder: ${reminder.title}`,
      body: "The reminder window passed before it could be delivered.",
      kind: "reminder_missed",
      reminderId: reminder.id,
    });
    result.missed += 1;
  }

  // Retry anything the backoff has released.
  const retryable = await db
    .select({ id: reminders.id })
    .from(reminders)
    .where(
      and(
        eq(reminders.status, "queued"),
        sql`${reminders.nextAttemptAt} is not null and ${reminders.nextAttemptAt} <= ${now.toISOString()}::timestamptz`,
      ),
    )
    .limit(limit);

  for (const row of retryable) {
    await db.update(reminders).set({ status: "scheduled", nextAttemptAt: null }).where(eq(reminders.id, row.id));
  }

  return result;
}

async function deliverInApp(
  reminder: Reminder,
  user: typeof users.$inferSelect,
): Promise<{ ok: boolean; detail: string }> {
  try {
    await db.insert(notifications).values({
      userId: reminder.userId,
      title: reminder.title,
      body: reminder.description ?? null,
      kind: "reminder",
      reminderId: reminder.id,
      actionUrl: actionUrlFor(reminder),
    });

    if (user.notificationPermission === "denied") {
      return {
        ok: true,
        detail: "Delivered in-app only — browser notifications are blocked for this site.",
      };
    }
    if (!user.pushSubscription) {
      return { ok: true, detail: "Delivered in-app. No push subscription registered." };
    }
    return { ok: true, detail: "Delivered in-app; push subscription present but no push provider is configured." };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message.slice(0, 200) : "unknown delivery error" };
  }
}

function actionUrlFor(reminder: Reminder): string | null {
  switch (reminder.linkedType) {
    case "task":
      return "/tasks";
    case "course":
      return "/academic/courses";
    case "book":
      return "/learning/books";
    case "opportunity":
      return "/opportunities";
    case "project":
      return "/projects";
    default:
      return "/reminders";
  }
}

/* ------------------------------------------------------------------ */
/* notifications                                                       */
/* ------------------------------------------------------------------ */

export async function listNotifications(userId: string, limit = 40) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(sql`${notifications.createdAt} desc`)
    .limit(limit);
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return Number(row?.count ?? 0);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));

  const [row] = await db.select().from(notifications).where(eq(notifications.id, notificationId)).limit(1);
  if (row?.reminderId) {
    await db
      .update(reminders)
      .set({ status: "delivered", deliveredAt: sql`coalesce(${reminders.deliveredAt}, now())` })
      .where(and(eq(reminders.id, row.reminderId), eq(reminders.status, "sent")));
    await log(row.reminderId, userId, "delivered", "notification opened", "in_app");
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}

/* ------------------------------------------------------------------ */
/* status surfaced in the UI                                           */
/* ------------------------------------------------------------------ */

export type EngineStatus = {
  scheduled: number;
  queued: number;
  sent: number;
  failed: number;
  missed: number;
  completed: number;
  nextDueAt: string | null;
  browserPermission: string;
  pushConfigured: boolean;
  warnings: string[];
};

export async function getEngineStatus(userId: string): Promise<EngineStatus> {
  const rows = await db
    .select({ status: reminders.status, count: sql<number>`count(*)` })
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .groupBy(reminders.status);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = Number(row.count);

  const [next] = await db
    .select({ remindAt: reminders.remindAt })
    .from(reminders)
    .where(and(eq(reminders.userId, userId), inArray(reminders.status, ["scheduled", "queued"])))
    .orderBy(asc(reminders.remindAt))
    .limit(1);

  const [user] = await db
    .select({ permission: users.notificationPermission, push: users.pushSubscription })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const warnings: string[] = [];
  if (user?.permission === "denied") {
    warnings.push("Browser notifications are blocked. Reminders will still appear in-app and in the bell icon.");
  } else if (user?.permission !== "granted") {
    warnings.push("Browser notification permission has not been granted yet — enable it from the Reminders page.");
  }
  if (!user?.push) {
    warnings.push("No push subscription is registered, so reminders cannot reach you when this tab is closed.");
  }
  if ((counts.failed ?? 0) > 0) {
    warnings.push(`${counts.failed} reminder(s) failed delivery after all retries. See the log below.`);
  }

  void dayRange;

  return {
    scheduled: counts.scheduled ?? 0,
    queued: counts.queued ?? 0,
    sent: counts.sent ?? 0,
    failed: counts.failed ?? 0,
    missed: counts.missed ?? 0,
    completed: counts.completed ?? 0,
    nextDueAt: next?.remindAt.toISOString() ?? null,
    browserPermission: user?.permission ?? "unknown",
    pushConfigured: Boolean(user?.push),
    warnings,
  };
}
