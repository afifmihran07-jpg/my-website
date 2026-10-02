import "server-only";
import { and, eq, isNull, lt, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
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

/**
 * Whether the session cookie may carry the `Secure` attribute.
 *
 * This has to describe the connection the browser is actually using, not the
 * build mode. `next start` runs with NODE_ENV=production even when it is being
 * served over plain http on localhost — and a browser silently *discards* a
 * `Secure` cookie received over http. That discard looks exactly like a login
 * that never completes: the action succeeds, the cookie is dropped, and the
 * redirect to /dashboard bounces straight back to /login.
 *
 * Order of precedence:
 *   1. COOKIE_SECURE=true|false — explicit override, for local http runs and
 *      for hosts that terminate TLS without forwarding the protocol.
 *   2. x-forwarded-proto — when behind a reverse proxy that reports it.
 *   3. NODE_ENV — the old behaviour, kept as the safe default.
 */
/**
 * Pure decision function behind {@link cookieIsSecure}, split out so the
 * behaviour can be tested without a live request.
 */
export function resolveCookieSecure(input: {
  override?: string | null;
  forwardedProto?: string | null;
  nodeEnv?: string | null;
}): boolean {
  if (input.override === "true") return true;
  if (input.override === "false") return false;
  if (input.forwardedProto) return input.forwardedProto.split(",")[0]!.trim() === "https";
  return (input.nodeEnv ?? process.env.NODE_ENV) === "production";
}

async function cookieIsSecure(): Promise<boolean> {
  let forwarded: string | null = null;
  try {
    forwarded = (await headers()).get("x-forwarded-proto");
  } catch {
    // Outside a request scope; fall through to the build-mode default.
  }
  return resolveCookieSecure({
    override: process.env.COOKIE_SECURE,
    forwardedProto: forwarded,
    nodeEnv: process.env.NODE_ENV,
  });
}

async function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: await cookieIsSecure(),
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
  jar.set(env().SESSION_COOKIE, token, await cookieOptions(ttlSeconds(remember)));

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
