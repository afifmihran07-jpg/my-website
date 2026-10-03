"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { aiPermissions, sessions, users } from "@/server/db/schema";
import { getSessionUser, publicUser, type PublicUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import { isValidTimeZone } from "@/server/lib/time";
import { exportCsv, exportUserData, csvTableNames, type CsvTableName } from "@/server/services/export";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  timezone: z.string().min(1).max(64),
  theme: z.enum(["light", "dark", "system"]),
  weekStartsOn: z.coerce.number().int().min(0).max(6),
});

const permissionSchema = z.object({
  academic: z.boolean(),
  grades: z.boolean(),
  study: z.boolean(),
  books: z.boolean(),
  tasks: z.boolean(),
  projects: z.boolean(),
  calendar: z.boolean(),
  polymath: z.boolean(),
  skills: z.boolean(),
  questions: z.boolean(),
  opportunities: z.boolean(),
  achievements: z.boolean(),
  diary: z.boolean(),
  photos: z.boolean(),
  medication: z.boolean(),
  prayer: z.boolean(),
});

export async function updateProfileAction(input: unknown): Promise<ActionResult<PublicUser>> {
  return safeAction("profile:update", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid profile");
    if (!isValidTimeZone(parsed.data.timezone)) return fail("That timezone is not recognised.");

    const [updated] = await db
      .update(users)
      .set(parsed.data)
      .where(eq(users.id, record.user.id))
      .returning();
    revalidatePath("/settings", "layout");
    return ok(publicUser(updated!));
  });
}

export async function updateAiPermissionsAction(input: unknown): Promise<ActionResult<Record<string, boolean>>> {
  return safeAction("privacy:update", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const parsed = permissionSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid permission payload");

    await db
      .insert(aiPermissions)
      .values({ userId: record.user.id, ...parsed.data })
      .onConflictDoUpdate({ target: aiPermissions.userId, set: parsed.data });

    revalidatePath("/settings");
    return ok(parsed.data);
  });
}

export async function exportJsonAction(): Promise<ActionResult<{ filename: string; content: string; rows: number }>> {
  return safeAction("export:json", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const payload = await exportUserData(record.user.id);
    const rows = Object.values(payload.data).reduce((sum, table) => sum + table.length, 0);
    return ok({
      filename: `afif-os-export-${new Date().toISOString().slice(0, 10)}.json`,
      content: JSON.stringify(payload, null, 2),
      rows,
    });
  });
}

export async function exportCsvAction(
  table: string,
): Promise<ActionResult<{ filename: string; content: string }>> {
  return safeAction("export:csv", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const allowed = csvTableNames() as readonly CsvTableName[];
    const target = allowed.find((name) => name === table);
    if (!target) return fail("That table cannot be exported.");
    const content = await exportCsv(record.user.id, target);
    return ok({ filename: `afif-os-${target}.csv`, content });
  });
}

export async function listSessionsAction(): Promise<
  ActionResult<Array<{ id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; expiresAt: string; current: boolean }>>
> {
  return safeAction("sessions:list", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, record.user.id), isNull(sessions.revokedAt)))
      .orderBy(desc(sessions.createdAt))
      .limit(20);
    return ok(
      rows.map((row) => ({
        id: row.id,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        current: row.id === record.session.id,
      })),
    );
  });
}
