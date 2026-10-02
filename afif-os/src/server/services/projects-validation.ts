import "server-only";
import { z } from "zod";

import { dateKey, iso, optionalText, optionalUrl, requiredText, uuid } from "@/server/services/common-validation";
import type { ProjectWithStats } from "@/server/services/projects";

export const projectStatus = z.enum(["planning", "active", "paused", "completed", "archived"]);

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

export const PROJECT_STATUS_LABELS: Record<z.infer<typeof projectStatus>, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const PROJECT_STATUS_TONES: Record<z.infer<typeof projectStatus>, "neutral" | "primary" | "accent" | "warning" | "danger"> = {
  planning: "neutral",
  active: "accent",
  paused: "warning",
  completed: "primary",
  archived: "neutral",
};
