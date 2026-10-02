import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { courses, opportunities, projects, tasks, type Task } from "@/server/db/schema";
import { dayRange, shiftDayKey, todayKey } from "@/server/lib/time";

export type TaskStatus = Task["status"];
export type TaskWithLinks = Task & {
  courseCode: string | null;
  courseName: string | null;
  courseColor: string | null;
  projectName: string | null;
  opportunityName: string | null;
};

/** Accepts the pool or a transaction handle so reads stay inside the same tx. */
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const withLinks = (client: DbClient = db) =>
  client
    .select({
      task: tasks,
      courseCode: courses.code,
      courseName: courses.name,
      courseColor: courses.color,
      projectName: projects.name,
      opportunityName: opportunities.name,
    })
    .from(tasks)
    .leftJoin(courses, eq(courses.id, tasks.courseId))
    .leftJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(opportunities, eq(opportunities.id, tasks.opportunityId));

type TaskLinkRow = {
  task: Task;
  courseCode: string | null;
  courseName: string | null;
  courseColor: string | null;
  projectName: string | null;
  opportunityName: string | null;
};

function flatten(row: TaskLinkRow): TaskWithLinks {
  return {
    ...row.task,
    courseCode: row.courseCode,
    courseName: row.courseName,
    courseColor: row.courseColor,
    projectName: row.projectName,
    opportunityName: row.opportunityName,
  };
}

export type TaskFilter = {
  status?: TaskStatus[];
  courseId?: string;
  projectId?: string;
  /** inclusive/exclusive bounds as YYYY-MM-DD — `due_date` is a date column */
  dueBefore?: string;
  dueAfter?: string;
  includeArchived?: boolean;
  limit?: number;
};

export async function listTasks(userId: string, filter: TaskFilter = {}): Promise<TaskWithLinks[]> {
  const conditions = [eq(tasks.userId, userId)];
  if (!filter.includeArchived) conditions.push(isNull(tasks.archivedAt));
  if (filter.status?.length) conditions.push(inArray(tasks.status, filter.status));
  if (filter.courseId) conditions.push(eq(tasks.courseId, filter.courseId));
  if (filter.projectId) conditions.push(eq(tasks.projectId, filter.projectId));
  if (filter.dueBefore) conditions.push(lt(tasks.dueDate, filter.dueBefore));
  if (filter.dueAfter) conditions.push(gte(tasks.dueDate, filter.dueAfter));

  const rows = await withLinks()
    .where(and(...conditions))
    .orderBy(
      asc(
        sql`case when ${tasks.dueDate} is null then 1 else 0 end`,
      ),
      asc(tasks.dueDate),
      asc(sql`array_position(array['urgent','high','medium','low'], ${tasks.priority}::text)`),
      desc(tasks.createdAt),
    )
    .limit(filter.limit ?? 300);

  return rows.map(flatten);
}

export type TaskBuckets = {
  overdue: TaskWithLinks[];
  today: TaskWithLinks[];
  upcoming: TaskWithLinks[];
  someday: TaskWithLinks[];
  inProgress: TaskWithLinks[];
  recentlyCompleted: TaskWithLinks[];
  counts: { open: number; overdue: number; today: number; completedToday: number };
};

/** Splits open work into Overdue / Today / Upcoming / Someday (§12). */
export async function getTaskBuckets(userId: string, timeZone: string, now = new Date()): Promise<TaskBuckets> {
  const today = todayKey(timeZone, now);
  const tomorrow = shiftDayKey(today, 1);
  const all = await listTasks(userId, { status: ["todo", "in_progress"] });

  const byKey = (key: string) => (task: TaskWithLinks) => task.dueDate === key;
  const overdue = all.filter((t) => t.dueDate !== null && t.dueDate < today && t.status !== "completed");
  const todayTasks = all.filter(byKey(today));
  const upcoming = all
    .filter((t) => t.dueDate !== null && t.dueDate > today && t.dueDate <= shiftDayKey(today, 14))
    .filter((t) => !todayTasks.includes(t));
  const someday = all.filter((t) => t.bucket === "someday" || t.dueDate === null);
  const inProgress = all.filter((t) => t.status === "in_progress");

  const range = dayRange(today, timeZone);
  const completed = await listTasks(userId, { status: ["completed"], includeArchived: true, limit: 200 });
  const completedToday = completed.filter(
    (t) => t.completedAt !== null && t.completedAt >= range.start && t.completedAt < range.end,
  );

  void tomorrow;

  return {
    overdue,
    today: todayTasks,
    upcoming: upcoming.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    someday,
    inProgress,
    recentlyCompleted: completed.slice(0, 8),
    counts: {
      open: all.length,
      overdue: overdue.length,
      today: todayTasks.length,
      completedToday: completedToday.length,
    },
  };
}

export type CreateTaskInput = {
  userId: string;
  title: string;
  description?: string | null;
  priority?: Task["priority"];
  status?: TaskStatus;
  dueDate?: string | null;
  dueTime?: string | null;
  estimatedMinutes?: number | null;
  category?: string | null;
  recurrence?: Task["recurrence"];
  courseId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  opportunityId?: string | null;
};

export async function createTask(input: CreateTaskInput): Promise<TaskWithLinks> {
  const title = input.title.trim();
  if (title.length < 1) throw new Error("Task title is required");
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new Error("Invalid due date");

  const [row] = await db
    .insert(tasks)
    .values({
      userId: input.userId,
      title,
      description: input.description?.trim() || null,
      priority: input.priority ?? "medium",
      status: input.status ?? "todo",
      bucket: input.dueDate ? "upcoming" : "someday",
      dueDate: input.dueDate ?? null,
      dueTime: normaliseTime(input.dueTime),
      estimatedMinutes: input.estimatedMinutes ?? null,
      category: input.category ?? null,
      recurrence: input.recurrence ?? "none",
      courseId: input.courseId ?? null,
      projectId: input.projectId ?? null,
      goalId: input.goalId ?? null,
      opportunityId: input.opportunityId ?? null,
    })
    .returning();

  const [linked] = await withLinks().where(eq(tasks.id, row!.id)).limit(1);
  return flatten(linked!);
}

export async function updateTask(
  userId: string,
  taskId: string,
  patch: Partial<Omit<CreateTaskInput, "userId" | "title">> & { title?: string; archived?: boolean },
): Promise<TaskWithLinks> {
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title.trim();
  if (patch.description !== undefined) updates.description = patch.description?.trim() || null;
  if (patch.priority !== undefined) updates.priority = patch.priority;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.dueDate !== undefined) updates.dueDate = patch.dueDate;
  if (patch.dueTime !== undefined) updates.dueTime = normaliseTime(patch.dueTime);
  if (patch.estimatedMinutes !== undefined) updates.estimatedMinutes = patch.estimatedMinutes;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.recurrence !== undefined) updates.recurrence = patch.recurrence;
  if (patch.courseId !== undefined) updates.courseId = patch.courseId;
  if (patch.projectId !== undefined) updates.projectId = patch.projectId;
  if (patch.opportunityId !== undefined) updates.opportunityId = patch.opportunityId;
  if (patch.archived !== undefined) updates.archivedAt = patch.archived ? new Date() : null;

  const [row] = await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();
  if (!row) throw new Error("Task not found");
  const [linked] = await withLinks().where(eq(tasks.id, row.id)).limit(1);
  return flatten(linked!);
}

/**
 * Status changes are validated server-side: `completedAt` is stamped here and
 * a recurring task spawns its next occurrence in the same transaction (§34).
 */
export async function setTaskStatus(
  userId: string,
  taskId: string,
  status: TaskStatus,
  now = new Date(),
): Promise<TaskWithLinks> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .limit(1);
    if (!current) throw new Error("Task not found");

    const completedAt = status === "completed" ? now : null;
    const [updated] = await tx
      .update(tasks)
      .set({ status, completedAt })
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
      .returning();

    if (status === "completed" && current.recurrence !== "none" && current.dueDate) {
      const nextDue = nextOccurrence(current.dueDate, current.recurrence);
      await tx.insert(tasks).values({
        userId,
        title: current.title,
        description: current.description,
        priority: current.priority,
        status: "todo",
        bucket: "upcoming",
        dueDate: nextDue,
        dueTime: current.dueTime,
        estimatedMinutes: current.estimatedMinutes,
        category: current.category,
        recurrence: current.recurrence,
        courseId: current.courseId,
        projectId: current.projectId,
        goalId: current.goalId,
        opportunityId: current.opportunityId,
      });
    }

    // Read through the SAME transaction: reading via the pool here would see
    // the pre-commit row and hand stale data back to the caller.
    const [linked] = await withLinks(tx).where(eq(tasks.id, updated!.id)).limit(1);
    return flatten(linked!);
  });
}

export function nextOccurrence(dueDate: string, recurrence: Task["recurrence"]): string {
  switch (recurrence) {
    case "daily":
      return shiftDayKey(dueDate, 1);
    case "weekly":
      return shiftDayKey(dueDate, 7);
    case "monthly": {
      const [y, m, d] = dueDate.split("-").map(Number) as [number, number, number];
      const next = new Date(Date.UTC(y, m, d));
      return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
        next.getUTCDate(),
      ).padStart(2, "0")}`;
    }
    default:
      return dueDate;
  }
}

function normaliseTime(value?: string | null): string | null {
  if (!value) return null;
  if (/^\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  return null;
}

export async function taskStats(userId: string) {
  const [row] = await db
    .select({
      open: sql<number>`count(*) filter (where ${tasks.status} in ('todo','in_progress') and ${tasks.archivedAt} is null)`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')`,
    })
    .from(tasks)
    .where(eq(tasks.userId, userId));
  return { open: Number(row?.open ?? 0), completed: Number(row?.completed ?? 0) };
}
