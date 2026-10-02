"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import { createGoal, createProject, getProject, updateProject } from "@/server/services/projects";
import {
  createGoalSchema,
  createProjectSchema,
  serializeProject,
  updateProjectSchema,
  type SerializedProject,
} from "@/server/services/projects-validation";

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate() {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath("/analytics");
}

export async function createProjectAction(input: unknown): Promise<ActionResult<SerializedProject>> {
  return safeAction("project:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the project details");

    const project = await createProject({ ...parsed.data, userId });
    const full = await getProject(userId, project.id);
    if (!full) return fail("Could not reload the project");
    revalidate();
    return ok(serializeProject(full));
  });
}

export async function updateProjectAction(projectId: string, input: unknown): Promise<ActionResult<SerializedProject>> {
  return safeAction("project:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateProjectSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the project details");

    const updated = await updateProject(userId, projectId, parsed.data);
    if (!updated) return fail("That project no longer exists.");

    const full = await getProject(userId, updated.id);
    if (!full) return fail("Could not reload the project");
    revalidate();
    return ok(serializeProject(full));
  });
}

export async function setProjectStatusAction(
  projectId: string,
  status: "planning" | "active" | "paused" | "completed" | "archived",
): Promise<ActionResult<SerializedProject>> {
  return safeAction("project:status", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createProjectSchema.shape.status.safeParse(status);
    if (!parsed.success) return fail("That is not a valid project status");

    const updated = await updateProject(userId, projectId, { status: parsed.data });
    if (!updated) return fail("That project no longer exists.");

    const full = await getProject(userId, updated.id);
    if (!full) return fail("Could not reload the project");
    revalidate();
    return ok(serializeProject(full));
  });
}

export async function createGoalAction(input: unknown): Promise<ActionResult<{ id: string; title: string }>> {
  return safeAction("goal:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createGoalSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the goal details");

    const goal = await createGoal({ ...parsed.data, userId });
    revalidate();
    return ok({ id: goal.id, title: goal.title });
  });
}
