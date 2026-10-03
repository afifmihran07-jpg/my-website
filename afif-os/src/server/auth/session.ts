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
export type CookieAttributes = {
  secure: boolean;
  sameSite: "lax" | "none";
  /**
   * CHIPS (Cookies Having Independent Partitioned State).
   *
   * A cookie set inside a cross-site iframe is a THIRD-PARTY cookie, and
   * browsers block those outright once third-party cookie blocking is on --
   * `SameSite=None; Secure` alone is not enough. `Partitioned` scopes the
   * cookie to the embedding top-level site instead, which is precisely the
   * mechanism designed to let an embedded app keep a session.
   */
  partitioned: boolean;
};

/**
 * Resolve the session cookie's transport attributes for the connection and
 * embedding context actually in use.
 *
 * Two independent things have to be right, and both are environment-dependent:
 *
 * 1. `Secure` must describe the wire protocol the BROWSER sees. `next start`
 *    runs with NODE_ENV=production even over plain http, and a browser silently
 *    discards a Secure cookie received over http.
 *
 * 2. `SameSite=Lax` cookies are NOT sent inside a cross-site iframe. Lax only
 *    rides along on top-level navigations. So when the app is embedded on
 *    another origin — a hosted preview pane, for instance — the browser stores
 *    the session cookie and then never sends it, which presents as a login that
 *    appears to succeed and then bounces straight back to /login. Embedded
 *    contexts need `SameSite=None`, which in turn requires `Secure`.
 *
 * Precedence for each: explicit env override, then request headers, then the
 * build-mode default.
 */
export function resolveCookieAttributes(input: {
  secureOverride?: string | null;
  sameSiteOverride?: string | null;
  forwardedProto?: string | null;
  secFetchSite?: string | null;
  secFetchDest?: string | null;
  partitionedOverride?: string | null;
  nodeEnv?: string | null;
}): CookieAttributes {
  const proto = input.forwardedProto?.split(",")[0]?.trim() ?? null;
  const https = proto === "https";

  let secure: boolean;
  if (input.secureOverride === "true") secure = true;
  else if (input.secureOverride === "false") secure = false;
  else if (proto) secure = https;
  else secure = (input.nodeEnv ?? process.env.NODE_ENV) === "production";

  // Embedded cross-site context: the document is framed by another origin.
  const embedded =
    input.secFetchDest === "iframe" ||
    input.secFetchDest === "frame" ||
    input.secFetchSite === "cross-site" ||
    input.secFetchSite === "same-site";

  let sameSite: "lax" | "none";
  if (input.sameSiteOverride === "none") sameSite = "none";
  else if (input.sameSiteOverride === "lax") sameSite = "lax";
  else sameSite = embedded ? "none" : "lax";

  // Browsers only deliver SameSite=None together with Secure, so once we have
  // decided the cookie must be None, Secure has to come with it. Promote it
  // rather than collapsing to Lax — unless Secure was explicitly forced off.
  //
  // Collapsing to Lax was the actual cause of the login redirect loop in the
  // hosted preview. Captured from the real browser, the login request arrives
  // as: x-forwarded-proto=http, sec-fetch-site=cross-site,
  // sec-fetch-dest=iframe. The proxy terminates TLS itself and forwards plain
  // http to the app, so `secure` derived to false from x-forwarded-proto even
  // though the browser is on https. That made the old guard below fire and
  // rewrite None to Lax. A Lax cookie IS stored by the browser but is never
  // sent inside a cross-site iframe, so /dashboard saw no session cookie and
  // bounced back to /login — a login that succeeds and immediately fails.
  //
  // Note x-forwarded-proto describes the proxy-to-app hop, not the
  // browser-to-proxy hop, so it can understate the scheme the browser sees.
  if (sameSite === "none" && !secure && input.secureOverride !== "false") secure = true;

  // Reachable only when Secure was explicitly forced off: browsers would drop
  // None outright, which is worse than Lax, so Lax is the survivable answer.
  if (sameSite === "none" && !secure) {
    return { secure: false, sameSite: "lax", partitioned: false };
  }

  // Partitioned requires Secure and only makes sense alongside SameSite=None.
  // Opt out explicitly with COOKIE_PARTITIONED="false"; default is on whenever
  // the cookie is already cross-site, since that is exactly the case that needs
  // it and it is ignored harmlessly by browsers that predate CHIPS.
  const partitioned =
    sameSite === "none" && secure && input.partitionedOverride !== "false";

  return { secure, sameSite, partitioned };
}

/** Retained for callers/tests that only care about the Secure attribute. */
export function resolveCookieSecure(input: {
  override?: string | null;
  forwardedProto?: string | null;
  nodeEnv?: string | null;
}): boolean {
  return resolveCookieAttributes({
    secureOverride: input.override,
    forwardedProto: input.forwardedProto,
    nodeEnv: input.nodeEnv,
  }).secure;
}

async function cookieAttributes(): Promise<CookieAttributes> {
  let forwarded: string | null = null;
  let site: string | null = null;
  let dest: string | null = null;
  try {
    const h = await headers();
    forwarded = h.get("x-forwarded-proto");
    site = h.get("sec-fetch-site");
    dest = h.get("sec-fetch-dest");
  } catch {
    // Outside a request scope; fall through to the build-mode defaults.
  }
  return resolveCookieAttributes({
    secureOverride: process.env.COOKIE_SECURE,
    sameSiteOverride: process.env.COOKIE_SAMESITE,
    partitionedOverride: process.env.COOKIE_PARTITIONED,
    forwardedProto: forwarded,
    secFetchSite: site,
    secFetchDest: dest,
    nodeEnv: process.env.NODE_ENV,
  });
}

async function cookieOptions(maxAgeSeconds: number) {
  const { secure, sameSite, partitioned } = await cookieAttributes();
  return {
    httpOnly: true,
    sameSite,
    secure,
    // Required by CHIPS: a partitioned cookie must be host-scoped to "/".
    path: "/",
    partitioned,
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
  // Clearing a cookie only works if the attributes MATCH the ones it was set
  // with — the browser identifies the cookie by (name, domain, path) plus, for
  // a partitioned cookie, the partition itself. A bare `jar.delete(name)` emits
  // no Secure/SameSite/Partitioned, so the partitioned session cookie would not
  // be matched and would survive logout. Reuse the same attribute resolver the
  // setter uses so the two always agree.
  const { secure, sameSite, partitioned } = await cookieAttributes();
  jar.delete({
    name: env().SESSION_COOKIE,
    path: "/",
    secure,
    sameSite,
    partitioned,
  });
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
