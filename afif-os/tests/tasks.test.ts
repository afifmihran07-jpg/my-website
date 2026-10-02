import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { tasks, type User } from "@/server/db/schema";
import { createTask, getTaskBuckets, nextOccurrence, setTaskStatus } from "@/server/services/tasks";
import { shiftDayKey, todayKey } from "@/server/lib/time";
import { TEST_TZ, cleanupUser, makeUser } from "./helpers";

let user: User;
let today: string;

beforeAll(async () => {
  user = await makeUser("tasks");
  today = todayKey(TEST_TZ);
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("tasks", () => {
  it("creates a task with a due date and links", async () => {
    const task = await createTask({
      userId: user.id,
      title: "Finish the assignment",
      priority: "high",
      dueDate: today,
      estimatedMinutes: 90,
      category: "coursework",
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe("todo");
    expect(task.dueDate).toBe(today);
    expect(task.completedAt).toBeNull();

    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id)).limit(1);
    expect(row?.title).toBe("Finish the assignment");
  });

  it("requires a title", async () => {
    await expect(createTask({ userId: user.id, title: "   " })).rejects.toThrow(/title/i);
  });

  it("rejects a malformed due date", async () => {
    await expect(createTask({ userId: user.id, title: "Bad date", dueDate: "02/10/2026" })).rejects.toThrow(/due date/i);
  });

  it("stamps completedAt server-side when a task is completed", async () => {
    const task = await createTask({ userId: user.id, title: "Complete me", dueDate: today });
    expect(task.completedAt).toBeNull();

    const before = Date.now();
    const completed = await setTaskStatus(user.id, task.id, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
    expect(completed.completedAt!.getTime()).toBeGreaterThanOrEqual(before - 5000);
  });

  it("clears completedAt when a task is reopened", async () => {
    const task = await createTask({ userId: user.id, title: "Reopen me", dueDate: today });
    await setTaskStatus(user.id, task.id, "completed");
    const reopened = await setTaskStatus(user.id, task.id, "todo");
    expect(reopened.status).toBe("todo");
    expect(reopened.completedAt).toBeNull();
  });

  it("splits work into overdue, today, upcoming and someday", async () => {
    await createTask({ userId: user.id, title: "Overdue task", dueDate: shiftDayKey(today, -3), priority: "urgent" });
    await createTask({ userId: user.id, title: "Today task", dueDate: today });
    await createTask({ userId: user.id, title: "Upcoming task", dueDate: shiftDayKey(today, 5) });
    await createTask({ userId: user.id, title: "Someday task" });

    const buckets = await getTaskBuckets(user.id, TEST_TZ);

    expect(buckets.overdue.some((task) => task.title === "Overdue task")).toBe(true);
    expect(buckets.today.some((task) => task.title === "Today task")).toBe(true);
    expect(buckets.upcoming.some((task) => task.title === "Upcoming task")).toBe(true);
    expect(buckets.someday.some((task) => task.title === "Someday task")).toBe(true);

    // Nothing appears in two buckets at once.
    const overdueIds = new Set(buckets.overdue.map((task) => task.id));
    expect(buckets.today.every((task) => !overdueIds.has(task.id))).toBe(true);
  });

  it("spawns the next occurrence when a recurring task is completed", async () => {
    const weekly = await createTask({ userId: user.id, title: "Weekly review", dueDate: today, recurrence: "weekly" });

    const before = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, user.id));
    await setTaskStatus(user.id, weekly.id, "completed");
    const after = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, user.id));

    expect(after.length).toBe(before.length + 1);

    const next = after.find((row) => !before.some((old) => old.id === row.id));
    const [nextTask] = await db.select().from(tasks).where(eq(tasks.id, next!.id)).limit(1);
    expect(nextTask?.dueDate).toBe(shiftDayKey(today, 7));
    expect(nextTask?.status).toBe("todo");
  });

  it("computes the next occurrence for each recurrence", () => {
    expect(nextOccurrence("2026-10-02", "daily")).toBe("2026-10-03");
    expect(nextOccurrence("2026-10-02", "weekly")).toBe("2026-10-09");
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-03-03");
    expect(nextOccurrence("2026-10-02", "none")).toBe("2026-10-02");
  });

  it("archives instead of deleting", async () => {
    const task = await createTask({ userId: user.id, title: "Archive me" });
    const [row] = await db
      .update(tasks)
      .set({ archivedAt: new Date() })
      .where(eq(tasks.id, task.id))
      .returning();
    expect(row?.archivedAt).not.toBeNull();

    const buckets = await getTaskBuckets(user.id, TEST_TZ);
    const allOpen = [...buckets.overdue, ...buckets.today, ...buckets.upcoming, ...buckets.someday];
    expect(allOpen.some((open) => open.id === task.id)).toBe(false);
  });
});
