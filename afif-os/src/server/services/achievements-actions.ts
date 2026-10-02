"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import {
  createAchievement,
  createCertificate,
  deleteCertificate,
  listAchievements,
  updateAchievement,
} from "@/server/services/achievements";
import {
  createAchievementSchema,
  createCertificateSchema,
  serializeAchievement,
  serializeCertificate,
  updateAchievementSchema,
  type SerializedAchievement,
  type SerializedCertificate,
} from "@/server/services/achievements-validation";

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate() {
  revalidatePath("/achievements");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export async function createAchievementAction(input: unknown): Promise<ActionResult<SerializedAchievement>> {
  return safeAction("achievement:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createAchievementSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the achievement details");

    const achievement = await createAchievement({ ...parsed.data, userId });
    const rows = await listAchievements(userId);
    const row = rows.find((item) => item.id === achievement.id);
    if (!row) return fail("Could not reload the achievement");
    revalidate();
    return ok(serializeAchievement(row));
  });
}

export async function updateAchievementAction(
  achievementId: string,
  input: unknown,
): Promise<ActionResult<SerializedAchievement>> {
  return safeAction("achievement:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateAchievementSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the achievement details");

    const updated = await updateAchievement(userId, achievementId, parsed.data);
    if (!updated) return fail("That achievement no longer exists.");

    const rows = await listAchievements(userId, true);
    const row = rows.find((item) => item.id === updated.id);
    if (!row) return fail("Could not reload the achievement");
    revalidate();
    return ok(serializeAchievement(row));
  });
}

export async function createCertificateAction(input: unknown): Promise<ActionResult<SerializedCertificate>> {
  return safeAction("certificate:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createCertificateSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the certificate details");

    const certificate = await createCertificate({ ...parsed.data, userId });
    revalidate();
    return ok(serializeCertificate({ ...certificate, skillName: null, courseName: null, expired: false }));
  });
}

export async function deleteCertificateAction(certificateId: string): Promise<ActionResult<{ id: string }>> {
  return safeAction("certificate:delete", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const removed = await deleteCertificate(userId, certificateId);
    if (!removed) return fail("That certificate no longer exists.");
    revalidate();
    return ok({ id: certificateId });
  });
}
