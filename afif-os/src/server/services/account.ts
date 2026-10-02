import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { aiPermissions, gradingRules, semesters, users, type User } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";

export type NewAccountInput = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  timezone?: string;
};

/**
 * Account creation is transactional: the user row, its AI permission defaults
 * and its default grading scale all land together or not at all (§34).
 */
export async function createAccount(input: NewAccountInput): Promise<User> {
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = ${input.username.toLowerCase()} or lower(${users.email}) = ${input.email.toLowerCase()}`)
      .limit(1);
    if (existing.length > 0) {
      throw new Error("That username or email is already in use");
    }

    const [user] = await tx
      .insert(users)
      .values({
        fullName: input.fullName,
        username: input.username.toLowerCase(),
        email: input.email.toLowerCase(),
        passwordHash,
        timezone: input.timezone ?? "Asia/Dhaka",
      })
      .returning();
    if (!user) throw new Error("Account creation failed");

    await tx.insert(aiPermissions).values({ userId: user.id });

    const hasRule = await tx.select({ id: gradingRules.id }).from(gradingRules).where(eq(gradingRules.userId, user.id)).limit(1);
    if (hasRule.length === 0) {
      await tx.insert(gradingRules).values({ userId: user.id, name: "4.00 scale", isDefault: true });
    }

    return user;
  });
}

/** Every account must have an AI permission row; create it lazily if absent. */
export async function ensureAiPermissions(userId: string): Promise<void> {
  const [row] = await db.select({ id: aiPermissions.id }).from(aiPermissions).where(eq(aiPermissions.userId, userId)).limit(1);
  if (!row) await db.insert(aiPermissions).values({ userId }).onConflictDoNothing();
}

export async function findUserByIdentifier(identifier: string): Promise<User | null> {
  const needle = identifier.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${needle} or lower(${users.email}) = ${needle}`)
    .limit(1);
  return row ?? null;
}

export async function hasAnyAccount(): Promise<boolean> {
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length > 0;
}

/** Ensures there is always one semester to attach courses to. */
export async function ensureActiveSemester(userId: string, name = "Semester 1") {
  const [active] = await db
    .select()
    .from(semesters)
    .where(sql`${semesters.userId} = ${userId} and ${semesters.status} = 'active'`)
    .limit(1);
  if (active) return active;
  const [created] = await db.insert(semesters).values({ userId, name, status: "active" }).returning();
  return created!;
}
