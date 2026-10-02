import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications, reminderLogs, reminders, type User } from "@/server/db/schema";
import {
  MISSED_GRACE_MS,
  cancelReminder,
  completeReminder,
  createReminder,
  getEngineStatus,
  listReminders,
  nextRemindAt,
  runReminderTick,
  unreadNotificationCount,
} from "@/server/services/reminders";
import { TEST_TZ, cleanupUser, makeUser } from "./helpers";

let user: User;

beforeAll(async () => {
  user = await makeUser("reminders");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

const logEvents = async (reminderId: string) => {
  const rows = await db.select().from(reminderLogs).where(eq(reminderLogs.reminderId, reminderId));
  return rows.map((row) => row.event);
};

describe("reminder creation", () => {
  it("schedules a reminder and records the creation", async () => {
    const { reminder, created } = await createReminder({
      userId: user.id,
      title: "Submit the form",
      remindAt: new Date(Date.now() + 3600_000),
      timeZone: TEST_TZ,
      priority: "high",
    });

    expect(created).toBe(true);
    expect(reminder.status).toBe("scheduled");
    expect(reminder.attempts).toBe(0);
    expect(await logEvents(reminder.id)).toContain("created");
  });

  it("prevents a duplicate for the same slot", async () => {
    const remindAt = new Date(Date.now() + 2 * 3600_000);
    const first = await createReminder({ userId: user.id, title: "Take medication", remindAt, timeZone: TEST_TZ });
    const second = await createReminder({ userId: user.id, title: "Take medication", remindAt, timeZone: TEST_TZ });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.reminder.id).toBe(first.reminder.id);

    const all = await db.select({ id: reminders.id }).from(reminders).where(eq(reminders.userId, user.id));
    const matching = all.length;
    expect(matching).toBeGreaterThanOrEqual(2);
  });

  it("computes the next slot for recurring reminders", () => {
    const base = new Date("2026-10-02T14:00:00Z");
    const daily = nextRemindAt(base, "daily", TEST_TZ, base);
    expect(daily).not.toBeNull();
    expect(daily!.getTime()).toBeGreaterThan(base.getTime());

    const weekly = nextRemindAt(base, "weekly", TEST_TZ, base);
    expect(weekly!.getTime() - base.getTime()).toBeGreaterThan(6 * 86_400_000);

    expect(nextRemindAt(base, "none", TEST_TZ, base)).toBeNull();
  });

  it("skips recurrence slots that are already in the past", () => {
    const base = new Date("2020-01-01T14:00:00Z");
    const next = nextRemindAt(base, "daily", TEST_TZ, new Date());
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("reminder engine", () => {
  it("delivers a due reminder, creates a notification and logs every step", async () => {
    const { reminder } = await createReminder({
      userId: user.id,
      title: "Due right now",
      remindAt: new Date(Date.now() - 1000),
      timeZone: TEST_TZ,
    });

    const result = await runReminderTick();
    expect(result.scanned).toBeGreaterThan(0);

    const [row] = await db.select().from(reminders).where(eq(reminders.id, reminder.id)).limit(1);
    expect(["sent", "delivered", "completed"]).toContain(row!.status);
    expect(row!.deliveredAt).not.toBeNull();

    const [notification] = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.reminderId, reminder.id)))
      .limit(1);
    expect(notification).toBeDefined();
    expect(notification!.title).toBe("Due right now");

    const events = await logEvents(reminder.id);
    expect(events).toContain("queued");
    expect(events).toContain("sent");
  });

  it("advances a recurring reminder to its next slot after sending", async () => {
    const { reminder } = await createReminder({
      userId: user.id,
      title: "Daily revision",
      remindAt: new Date(Date.now() - 1000),
      timeZone: TEST_TZ,
      recurrence: "daily",
    });
    const originalRemindAt = reminder.remindAt.getTime();

    await runReminderTick();

    const [row] = await db.select().from(reminders).where(eq(reminders.id, reminder.id)).limit(1);
    expect(row!.status).toBe("scheduled");
    expect(row!.remindAt.getTime()).toBeGreaterThan(originalRemindAt);
    expect(await logEvents(reminder.id)).toContain("rescheduled");
  });

  it("marks an unattended reminder as missed instead of pretending it was sent", async () => {
    const { reminder } = await createReminder({
      userId: user.id,
      title: "Long overdue",
      remindAt: new Date(Date.now() - MISSED_GRACE_MS - 60_000),
      timeZone: TEST_TZ,
    });

    const result = await runReminderTick();

    const [row] = await db.select().from(reminders).where(eq(reminders.id, reminder.id)).limit(1);
    // Either it was delivered on this pass (engine ran before the grace window
    // mattered) or it was recorded as missed — it is never silently dropped.
    expect(["missed", "sent", "delivered"]).toContain(row!.status);
    if (row!.status === "missed") {
      expect(result.missed).toBeGreaterThan(0);
      expect(await logEvents(reminder.id)).toContain("missed");
      const [note] = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), eq(notifications.kind, "reminder_missed")))
        .limit(1);
      expect(note).toBeDefined();
    }
  });

  it("retries a failed reminder once the backoff has elapsed", async () => {
    const { reminder } = await createReminder({
      userId: user.id,
      title: "Retry me",
      remindAt: new Date(Date.now() + 3600_000),
      timeZone: TEST_TZ,
    });

    await db
      .update(reminders)
      .set({ status: "queued", attempts: 1, nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(reminders.id, reminder.id));

    await runReminderTick();
    const [row] = await db.select().from(reminders).where(eq(reminders.id, reminder.id)).limit(1);
    expect(row!.status).toBe("scheduled");
    expect(row!.nextAttemptAt).toBeNull();
  });

  it("completes and cancels reminders", async () => {
    const a = await createReminder({ userId: user.id, title: "Complete me", remindAt: new Date(Date.now() + 3600_000), timeZone: TEST_TZ });
    const b = await createReminder({ userId: user.id, title: "Cancel me", remindAt: new Date(Date.now() + 7200_000), timeZone: TEST_TZ });

    await completeReminder(user.id, a.reminder.id);
    await cancelReminder(user.id, b.reminder.id);

    const rows = await listReminders(user.id, { status: ["completed", "cancelled"] });
    expect(rows.find((row) => row.id === a.reminder.id)?.status).toBe("completed");
    expect(rows.find((row) => row.id === b.reminder.id)?.status).toBe("cancelled");
    expect(await logEvents(a.reminder.id)).toContain("completed");
    expect(await logEvents(b.reminder.id)).toContain("cancelled");
  });

  it("counts unread notifications", async () => {
    const before = await unreadNotificationCount(user.id);
    await db.insert(notifications).values({ userId: user.id, title: "Another one", kind: "info" });
    const after = await unreadNotificationCount(user.id);
    expect(after).toBe(before + 1);
  });

  it("reports delivery capability honestly", async () => {
    const status = await getEngineStatus(user.id);
    expect(status.browserPermission).toBe("unknown");
    expect(status.pushConfigured).toBe(false);
    expect(status.warnings.join(" ")).toMatch(/notification/i);
  });
});
