"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import { createTask, setTaskStatus, updateTask } from "@/server/services/tasks";
import { createReminderFromTask } from "@/server/services/reminders";
import { createTaskSchema, serializeTask, type SerializedTask, type TaskStatusInput } from "@/server/services/task-dto";

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/calendar");
}

export async function createTaskAction(input: unknown): Promise<ActionResult<SerializedTask>> {
  return safeAction("task:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid task");
    const { remindAt, ...rest } = parsed.data;
    const task = await createTask({ ...rest, userId });
    if (remindAt) await createReminderFromTask({ userId, task, remindAt });
    revalidate();
    return ok(serializeTask(task));
  });
}

export async function updateTaskAction(
  taskId: string,
  input: Partial<z.infer<typeof createTaskSchema>> & { archived?: boolean; title?: string },
): Promise<ActionResult<SerializedTask>> {
  return safeAction("task:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const task = await updateTask(userId, taskId, input);
    revalidate();
    return ok(serializeTask(task));
  });
}

export async function setTaskStatusAction(taskId: string, nextStatus: TaskStatusInput): Promise<ActionResult<SerializedTask>> {
  return safeAction("task:status", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    const parsed = z.enum(["todo", "in_progress", "completed", "cancelled"]).safeParse(nextStatus);
    if (!parsed.success) return fail("Invalid status");
    const task = await setTaskStatus(userId, taskId, parsed.data);
    revalidate();
    return ok(serializeTask(task));
  });
}
