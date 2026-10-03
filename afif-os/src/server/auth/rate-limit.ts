import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { loginAttempts, users } from "@/server/db/schema";

/**
 * Two layers:
 *  1. an in-process sliding window keyed by IP + identifier — protects against
 *     spray attacks before the account is even resolved;
 *  2. a persisted lockout on the user row — survives restarts and works across
 *     instances that share the database.
 *
 * A single-instance in-memory window is enough for a one-user system; the
 * persisted lockout is what actually enforces the policy under load.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 10;
const MAX_FAILURES_BEFORE_LOCK = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

const window = new Map<string, number[]>();

function key(ip: string, identifier: string) {
  return `${ip}::${identifier.toLowerCase()}`;
}

export function windowAttempts(ip: string, identifier: string): number {
  const now = Date.now();
  const hits = (window.get(key(ip, identifier)) ?? []).filter((t) => now - t < WINDOW_MS);
  window.set(key(ip, identifier), hits);
  return hits.length;
}

function recordAttempt(ip: string, identifier: string) {
  const now = Date.now();
  const k = key(ip, identifier);
  window.set(k, [...(window.get(k) ?? []).filter((t) => now - t < WINDOW_MS), now]);
  // keep the map from growing without bound
  if (window.size > 5000) {
    for (const [mapKey, times] of window) {
      const live = times.filter((t) => now - t < WINDOW_MS);
      if (live.length === 0) window.delete(mapKey);
      else window.set(mapKey, live);
    }
  }
}

export type RateLimitDecision = { allowed: true; retryAfterSeconds?: number } | { allowed: false; retryAfterSeconds: number };

/** Call before doing any password work. */
export async function checkLoginAllowed(ip: string, identifier: string): Promise<RateLimitDecision> {
  const attempts = windowAttempts(ip, identifier);
  if (attempts >= MAX_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }

  const [user] = await db
    .select({ id: users.id, lockedUntil: users.lockedUntil })
    .from(users)
    .where(eq(users.username, identifier.toLowerCase()))
    .limit(1);
  const [byEmail] = await db
    .select({ id: users.id, lockedUntil: users.lockedUntil })
    .from(users)
    .where(eq(users.email, identifier.toLowerCase()))
    .limit(1);
  const lockedUntil = user?.lockedUntil ?? byEmail?.lockedUntil;

  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return { allowed: false, retryAfterSeconds: Math.ceil((lockedUntil.getTime() - Date.now()) / 1000) };
  }
  return { allowed: true };
}

export async function registerFailedLogin(input: {
  ip: string;
  identifier: string;
  userAgent?: string | null;
  userId?: string | null;
}): Promise<void> {
  recordAttempt(input.ip, input.identifier);

  await db.insert(loginAttempts).values({
    identifier: input.identifier.toLowerCase(),
    ipAddress: input.ip,
    succeeded: false,
    userAgent: input.userAgent?.slice(0, 512) ?? null,
  });

  if (!input.userId) return;

  const [row] = await db
    .select({ failed: users.failedLoginAttempts })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const failed = (row?.failed ?? 0) + 1;

  if (failed >= MAX_FAILURES_BEFORE_LOCK) {
    const steps = Math.min(failed - MAX_FAILURES_BEFORE_LOCK, 5);
    const lockMs = Math.min(BASE_LOCK_MS * 2 ** steps, MAX_LOCK_MS);
    await db
      .update(users)
      .set({ failedLoginAttempts: failed, lockedUntil: new Date(Date.now() + lockMs) })
      .where(eq(users.id, input.userId));
  } else {
    await db.update(users).set({ failedLoginAttempts: failed }).where(eq(users.id, input.userId));
  }
}

export async function registerSuccessfulLogin(input: {
  ip: string;
  identifier: string;
  userAgent?: string | null;
  userId: string;
}): Promise<void> {
  window.delete(key(input.ip, input.identifier));
  await db.insert(loginAttempts).values({
    identifier: input.identifier.toLowerCase(),
    ipAddress: input.ip,
    succeeded: true,
    userAgent: input.userAgent?.slice(0, 512) ?? null,
  });
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, input.userId));
}

/** Test helper — clears the in-process window. */
export function resetRateLimitWindow(): void {
  window.clear();
}

/** How many accounts exist — drives the "first user setup" screen. */
export async function countActiveUsers(): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users).where(gt(users.createdAt, new Date(0)));
  return rows.length;
}
