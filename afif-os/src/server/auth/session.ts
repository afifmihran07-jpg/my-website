import "server-only";
import { and, eq, isNull, lt, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { sessions, users, type User } from "@/server/db/schema";
import { env } from "@/server/env";
import { hashToken, randomToken, safeEqual } from "./crypto";

export const REMEMBER_DAYS = 30;
const THROTTLE_MS = 60_000;

export function ttlSeconds(remember: boolean): number {
  return remember ? REMEMBER_DAYS * 24 * 3600 : env().SESSION_TTL_HOURS * 3600;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Secure only when served over HTTPS (production). Local dev is http.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export type SessionRecord = {
  session: typeof sessions.$inferSelect;
  user: User;
};

/**
 * Creates a session row and sets the HTTP-only cookie.
 * The raw token leaves this function exactly once — into the cookie.
 */
export async function createSession(
  userId: string,
  meta: { remember?: boolean; userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const remember = meta.remember ?? false;
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ttlSeconds(remember) * 1000);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    remember,
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
    ipAddress: meta.ipAddress ?? null,
    expiresAt,
  });

  const jar = await cookies();
  jar.set(env().SESSION_COOKIE, token, cookieOptions(ttlSeconds(remember)));

  return { token, expiresAt };
}

/** Resolves a raw token to a live session + user. Pure function of the token. */
export async function resolveSessionToken(token: string | undefined | null): Promise<SessionRecord | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);

  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!safeEqual(row.session.tokenHash, tokenHash)) return null;

  const lastSeen = row.session.lastSeenAt?.getTime() ?? 0;
  if (Date.now() - lastSeen > THROTTLE_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.id, row.session.id));
  }

  return { session: row.session, user: row.user };
}

/** Reads the session cookie and resolves the signed-in user. */
export async function getSessionUser(): Promise<SessionRecord | null> {
  const jar = await cookies();
  return resolveSessionToken(jar.get(env().SESSION_COOKIE)?.value);
}

/**
 * Server-side gate used by every protected page and action.
 * Redirects to /login when there is no valid session.
 */
export async function requireUser(): Promise<User> {
  const record = await getSessionUser();
  if (!record) {
    redirect("/login?reason=auth_required");
  }
  return record.user;
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(env().SESSION_COOKIE)?.value;
  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)));
  }
  jar.delete(env().SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/** Housekeeping for expired/revoked rows — never a blanket DELETE. */
export async function pruneExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const removed = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, cutoff))
    .returning({ id: sessions.id });
  return removed.length;
}

/** A user record that is safe to hand to the client. No hash, ever. */
export function publicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    theme: user.theme,
    weekStartsOn: user.weekStartsOn,
    notificationPermission: user.notificationPermission,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
