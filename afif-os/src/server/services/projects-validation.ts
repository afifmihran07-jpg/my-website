import "server-only";
import { z } from "zod";

import { dateKey, iso, optionalText, optionalUrl, requiredText, uuid } from "@/server/services/common-validation";
import type { ProjectWithStats } from "@/server/services/projects";
import { PROJECT_STATUS_NAMES } from "@/lib/labels";

export const projectStatus = z.enum(PROJECT_STATUS_NAMES);

export const createProjectSchema = z.object({
  name: requiredText(160, "Project name"),
  description: optionalText(4000, "Description"),
  status: projectStatus.default("planning"),
  startDate: dateKey,
  targetDate: dateKey,
  goalId: uuid,
  url: optionalUrl,
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const createGoalSchema = z.object({
  title: requiredText(160, "Goal"),
  description: optionalText(4000, "Description"),
  targetDate: dateKey,
});

export function serializeProject(project: ProjectWithStats) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    targetDate: project.targetDate,
    completedAt: iso(project.completedAt),
    goalId: project.goalId,
    goalTitle: project.goalTitle,
    url: project.url,
    tasksTotal: project.tasksTotal,
    tasksDone: project.tasksDone,
    taskCompletion: project.taskCompletion,
    studySeconds: project.studySeconds,
    studySessionCount: project.studySessionCount,
    noteCount: project.noteCount,
    achievementCount: project.achievementCount,
    daysToTarget: project.daysToTarget,
    createdAt: iso(project.createdAt),
    updatedAt: iso(project.updatedAt),
  };
}

export type SerializedProject = ReturnType<typeof serializeProject>;

