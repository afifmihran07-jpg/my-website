"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import { createOpportunity, getOpportunity, updateOpportunity } from "@/server/services/opportunities";
import {
  createOpportunitySchema,
  serializeOpportunity,
  updateOpportunitySchema,
  type SerializedOpportunity,
} from "@/server/services/opportunities-validation";
import { createReminder } from "@/server/services/reminders";

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate() {
  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
  revalidatePath("/reminders");
}

/**
 * A deadline reminder is only created when the user asked for one and the
 * deadline is still in the future. The dedupe key inside createReminder means
 * editing the opportunity twice will not stack duplicate reminders.
 */
async function syncDeadlineReminder(userId: string, timeZone: string, opportunityId: string, data: {
  name: string;
  deadline: string | null | undefined;
  reminderEnabled: boolean | undefined;
  type: string;
}) {
  if (!data.reminderEnabled || !data.deadline) return;
  const remindAt = new Date(`${data.deadline}T09:00:00`);
  if (Number.isNaN(remindAt.getTime()) || remindAt.getTime() <= Date.now()) return;

  await createReminder({
    userId,
    title: `${data.name} — deadline`,
    description: `Deadline for this ${data.type.replace("_", " ")} is ${data.deadline}.`,
    remindAt,
    timeZone,
    priority: "high",
    linkedType: "opportunity",
    linkedId: opportunityId,
  });
}

export async function createOpportunityAction(input: unknown): Promise<ActionResult<SerializedOpportunity>> {
  return safeAction("opportunity:create", async () => {
    const record = await getSessionUser();
    const userId = record?.user.id ?? null;
    if (!userId) return fail("You need to be signed in.");

    const parsed = createOpportunitySchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the opportunity details");

    const created = await createOpportunity({ ...parsed.data, userId });
    await syncDeadlineReminder(userId, record!.user.timezone, created.id, {
      name: created.name,
      deadline: created.deadline,
      reminderEnabled: parsed.data.reminderEnabled,
      type: created.type,
    });

    const full = await getOpportunity(userId, created.id);
    if (!full) return fail("Could not reload the opportunity");
    revalidate();
    return ok(serializeOpportunity(full));
  });
}

export async function updateOpportunityAction(
  opportunityId: string,
  input: unknown,
): Promise<ActionResult<SerializedOpportunity>> {
  return safeAction("opportunity:update", async () => {
    const record = await getSessionUser();
    const userId = record?.user.id ?? null;
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateOpportunitySchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the opportunity details");

    const updated = await updateOpportunity(userId, opportunityId, parsed.data);
    if (!updated) return fail("That opportunity no longer exists.");

    await syncDeadlineReminder(userId, record!.user.timezone, updated.id, {
      name: updated.name,
      deadline: updated.deadline,
      reminderEnabled: updated.reminderEnabled,
      type: updated.type,
    });

    const full = await getOpportunity(userId, updated.id);
    if (!full) return fail("Could not reload the opportunity");
    revalidate();
    return ok(serializeOpportunity(full));
  });
}
