import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, type User } from "@/server/db/schema";
import { createAccount } from "@/server/services/account";

/**
 * Every test file creates its own account and removes it afterwards.
 * Deleting the user cascades through every owned table, so no test can leak
 * rows into another — and no test ever touches a row it did not create.
 */
export async function makeUser(prefix = "test"): Promise<User> {
  const id = randomUUID().slice(0, 8);
  return createAccount({
    fullName: `${prefix} user ${id}`,
    username: `${prefix}_${id}`,
    email: `${prefix}.${id}@example.test`,
    password: "Str0ng!TestPassword",
    timezone: "Asia/Dhaka",
  });
}

export async function cleanupUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

export function uniqueKey(prefix = "key"): string {
  return `${prefix}-${randomUUID()}`;
}

/** Asia/Dhaka is UTC+6 with no DST, which keeps the expectations readable. */
export const TEST_TZ = "Asia/Dhaka";
