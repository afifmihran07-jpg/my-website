import "server-only";
import { z } from "zod";
import type { TaskWithLinks } from "@/server/services/tasks";

/**
 * Task validation + wire format.
 *
 * Kept out of the `"use server"` module on purpose: Next requires every export
 * of a server-action file to be an async function, and both the Zod schema and
 * the serialiser are needed by client components for form state.
 */

const priority = z.enum(["low", "medium", "high", "urgent"]);
const status = z.enum(["todo", "in_progress", "completed", "cancelled"]);
const recurrence = z.enum(["none", "daily", "weekly", "monthly", "custom"]);
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .nullable()
  .optional();
const timeValue = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use the format HH:MM")
  .nullable()
  .optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  priority: priority.default("medium"),
  status: status.default("todo"),
  dueDate: dateKey,
  dueTime: timeValue,
  estimatedMinutes: z.coerce.number().int().min(1).max(24 * 60).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  recurrence: recurrence.default("none"),
  courseId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  opportunityId: z.string().uuid().nullable().optional(),
  remindAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;
export type TaskStatusInput = z.infer<typeof status>;

export function serializeTask(task: TaskWithLinks) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    bucket: task.bucket,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    estimatedMinutes: task.estimatedMinutes,
    category: task.category,
    recurrence: task.recurrence,
    courseId: task.courseId,
    projectId: task.projectId,
    opportunityId: task.opportunityId,
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    courseCode: task.courseCode,
    courseName: task.courseName,
    courseColor: task.courseColor,
    projectName: task.projectName,
    opportunityName: task.opportunityName,
  };
}

export type SerializedTask = ReturnType<typeof serializeTask>;
