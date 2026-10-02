import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  achievements,
  goals,
  notes,
  projects,
  studySessions,
  tasks,
  type Project,
} from "@/server/db/schema";

export type ProjectStatus = Project["status"];
export const PROJECT_STATUSES: ProjectStatus[] = ["planning", "active", "paused", "completed", "archived"];

export type ProjectWithStats = Project & {
  goalTitle: string | null;
  tasksTotal: number;
  tasksDone: number;
  studySeconds: number;
  studySessionCount: number;
  noteCount: number;
  achievementCount: number;
  /** derived, never stored: share of linked tasks completed */
  taskCompletion: number | null;
  daysToTarget: number | null;
};

/**
 * Whole calendar days between today and a YYYY-MM-DD date.
 *
 * Comparing dates rather than instants keeps "3 days left" meaning three
 * calendar days instead of rounding a 3.4-day gap up to 4.
 */
export function calendarDaysUntil(dateKey: string): number {
  const target = Date.parse(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(target)) return 0;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((target - today) / MS_PER_DAY);
}

const MS_PER_DAY = 86_400_000;

async function queryProjects(userId: string, filter: { status?: ProjectStatus | "all"; includeArchived?: boolean }) {
  const conditions = [eq(projects.userId, userId)];
  if (!filter.includeArchived) conditions.push(isNull(projects.archivedAt));
  if (filter.status && filter.status !== "all") conditions.push(eq(projects.status, filter.status));

  const rows = await db
    .select({
      project: projects,
      goalTitle: goals.title,
      tasksTotal: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.archivedAt} is null)`,
      tasksDone: sql<number>`(select count(*) from ${tasks} where ${tasks.projectId} = ${projects.id} and ${tasks.status} = 'completed' and ${tasks.archivedAt} is null)`,
      studySeconds: sql<number>`coalesce((select sum(${studySessions.durationSeconds}) from ${studySessions} where ${studySessions.projectId} = ${projects.id} and ${studySessions.status} = 'completed'), 0)`,
      studySessionCount: sql<number>`(select count(*) from ${studySessions} where ${studySessions.projectId} = ${projects.id} and ${studySessions.status} = 'completed')`,
      noteCount: sql<number>`(select count(*) from ${notes} where ${notes.projectId} = ${projects.id} and ${notes.archivedAt} is null)`,
      achievementCount: sql<number>`(select count(*) from ${achievements} where ${achievements.projectId} = ${projects.id})`,
    })
    .from(projects)
    .leftJoin(goals, eq(goals.id, projects.goalId))
    .where(and(...conditions))
    .orderBy(desc(projects.updatedAt));

  return rows.map(({ project, goalTitle, tasksTotal, tasksDone, studySeconds, studySessionCount, noteCount, achievementCount }) => {
    const total = Number(tasksTotal);
    const done = Number(tasksDone);
    return {
      ...project,
      goalTitle,
      tasksTotal: total,
      tasksDone: done,
      studySeconds: Number(studySeconds),
      studySessionCount: Number(studySessionCount),
      noteCount: Number(noteCount),
      achievementCount: Number(achievementCount),
      taskCompletion: total > 0 ? Math.round((done / total) * 100) : null,
      daysToTarget: project.targetDate ? calendarDaysUntil(project.targetDate) : null,
    } satisfies ProjectWithStats;
  });
}

export async function listProjects(
  userId: string,
  filter: { status?: ProjectStatus | "all"; includeArchived?: boolean } = {},
): Promise<ProjectWithStats[]> {
  return queryProjects(userId, filter);
}

export async function getProject(userId: string, projectId: string): Promise<ProjectWithStats | null> {
  const rows = await queryProjects(userId, { status: "all", includeArchived: true });
  return rows.find((row) => row.id === projectId) ?? null;
}

export type CreateProjectInput = {
  userId: string;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  targetDate?: string | null;
  goalId?: string | null;
  url?: string | null;
};

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const [row] = await db
    .insert(projects)
    .values({
      userId: input.userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: input.status ?? "planning",
      startDate: input.startDate || null,
      targetDate: input.targetDate || null,
      goalId: input.goalId || null,
      url: input.url?.trim() || null,
    })
    .returning();
  return row!;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "userId">> & { archived?: boolean };

export async function updateProject(userId: string, projectId: string, patch: UpdateProjectInput): Promise<Project | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  if (patch.startDate !== undefined) values.startDate = patch.startDate || null;
  if (patch.targetDate !== undefined) values.targetDate = patch.targetDate || null;
  if (patch.goalId !== undefined) values.goalId = patch.goalId || null;
  if (patch.url !== undefined) values.url = patch.url?.trim() || null;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  if (patch.status !== undefined) {
    values.status = patch.status;
    // Completion is stamped once; reopening clears it so history stays truthful.
    if (patch.status === "completed") {
      const [existing] = await db.select({ completedAt: projects.completedAt }).from(projects).where(eq(projects.id, projectId)).limit(1);
      values.completedAt = existing?.completedAt ?? new Date();
    } else {
      values.completedAt = null;
    }
  }

  const [row] = await db
    .update(projects)
    .set(values)
    .where(and(eq(projects.userId, userId), eq(projects.id, projectId)))
    .returning();
  return row ?? null;
}

export type ProjectSummary = {
  total: number;
  active: number;
  planning: number;
  paused: number;
  completed: number;
  openTasks: number;
  studySeconds: number;
};

export async function projectSummary(userId: string): Promise<ProjectSummary> {
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${projects.archivedAt} is null)`,
      active: sql<number>`count(*) filter (where ${projects.status} = 'active')`,
      planning: sql<number>`count(*) filter (where ${projects.status} = 'planning')`,
      paused: sql<number>`count(*) filter (where ${projects.status} = 'paused')`,
      completed: sql<number>`count(*) filter (where ${projects.status} = 'completed')`,
    })
    .from(projects)
    .where(eq(projects.userId, userId));

  const ids = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)));

  let openTasks = 0;
  let studySeconds = 0;
  if (ids.length > 0) {
    const projectIds = ids.map((item) => item.id);
    const [taskRow] = await db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.archivedAt),
          inArray(tasks.projectId, projectIds),
          sql`${tasks.status} in ('todo', 'in_progress')`,
        ),
      );
    openTasks = Number(taskRow?.n ?? 0);

    const [studyRow] = await db
      .select({ total: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)` })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.userId, userId),
          eq(studySessions.status, "completed"),
          inArray(studySessions.projectId, projectIds),
        ),
      );
    studySeconds = Number(studyRow?.total ?? 0);
  }

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    planning: Number(row?.planning ?? 0),
    paused: Number(row?.paused ?? 0),
    completed: Number(row?.completed ?? 0),
    openTasks,
    studySeconds,
  };
}

export async function projectOptions(userId: string) {
  return db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt))
    .limit(200);
}

export async function goalOptions(userId: string) {
  return db
    .select({ id: goals.id, title: goals.title, status: goals.status })
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.archivedAt)))
    .orderBy(desc(goals.createdAt))
    .limit(200);
}

export async function createGoal(input: { userId: string; title: string; description?: string | null; targetDate?: string | null }) {
  const [row] = await db
    .insert(goals)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      targetDate: input.targetDate || null,
      status: "active",
    })
    .returning();
  return row!;
}

export async function projectDetail(userId: string, projectId: string) {
  const project = await getProject(userId, projectId);
  if (!project) return null;

  const [projectTasks, projectNotes, projectAchievements, projectStudy] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
      .orderBy(desc(tasks.createdAt))
      .limit(200),
    db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.projectId, projectId), isNull(notes.archivedAt)))
      .orderBy(desc(notes.updatedAt))
      .limit(50),
    db
      .select()
      .from(achievements)
      .where(and(eq(achievements.userId, userId), eq(achievements.projectId, projectId)))
      .orderBy(desc(achievements.occurredOn))
      .limit(50),
    db
      .select()
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.projectId, projectId), eq(studySessions.status, "completed")))
      .orderBy(desc(studySessions.startedAt))
      .limit(30),
  ]);

  return { project, tasks: projectTasks, notes: projectNotes, achievements: projectAchievements, study: projectStudy };
}
