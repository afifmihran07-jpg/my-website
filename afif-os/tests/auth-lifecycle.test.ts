import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { hashToken, randomToken } from "@/server/auth/crypto";
import { verifyPassword } from "@/server/auth/password";
import { publicUser, resolveCookieAttributes, resolveSessionToken, revokeAllSessions } from "@/server/auth/session";
import { cleanupUser, makeUser } from "./helpers";
import type { User } from "@/server/db/schema";

/**
 * End-to-end authentication lifecycle, and the specific guard against the
 * redirect-loop bug where login appears to succeed and the next protected page
 * bounces straight back to /login.
 *
 * That bug had two possible causes, and both are pinned here:
 *
 *  1. The session token written at login did not resolve on the following
 *     request (mismatched cookie name, expired or revoked row).
 *  2. The cookie was never sent back at all, because its attributes did not
 *     suit the transport: `Secure` over plain http is discarded by the browser,
 *     and `SameSite=Lax` is never sent inside a cross-site iframe — which is
 *     how a hosted preview pane embeds this app.
 *
 * Cause 1 is exercised against the real database. Cause 2 is exercised through
 * resolveCookieAttributes for each deployment context.
 */

let user: User;

beforeAll(async () => {
  user = await makeUser("lifecycle");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

/** Mirrors createSession's database write without needing a request scope. */
async function issueSession(userId: string, remember = false) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + (remember ? 30 * 24 : 12) * 3600_000);
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    remember,
  });
  return { token, expiresAt };
}

describe("authentication lifecycle", () => {
  it("login → session row → resolves to the same user", async () => {
    const { token } = await issueSession(user.id);

    const record = await resolveSessionToken(token);
    expect(record).not.toBeNull();
    expect(record!.user.id).toBe(user.id);
    // The user object handed to a page must never carry the password hash.
    expect(publicUser(record!.user)).not.toHaveProperty("passwordHash");
  });

  it("the session row is live and unexpired immediately after login", async () => {
    const { token } = await issueSession(user.id);
    const [row] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, hashToken(token)), isNull(sessions.revokedAt)))
      .limit(1);

    expect(row).toBeTruthy();
    expect(row!.userId).toBe(user.id);
    expect(row!.revokedAt).toBeNull();
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("stays authenticated across repeated protected-page loads (refresh)", async () => {
    const { token } = await issueSession(user.id);

    // Simulates the dashboard being requested, then refreshed several times.
    for (let i = 0; i < 4; i += 1) {
      const record = await resolveSessionToken(token);
      expect(record?.user.id).toBe(user.id);
    }
  });

  it("logout revokes the session so protected pages become inaccessible", async () => {
    const { token } = await issueSession(user.id);
    expect(await resolveSessionToken(token)).not.toBeNull();

    await revokeAllSessions(user.id);

    // The row is soft-revoked, never hard-deleted, and stops resolving at once.
    await expect(resolveSessionToken(token)).resolves.toBeNull();
    const [row] = await db
      .select({ revokedAt: sessions.revokedAt })
      .from(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)))
      .limit(1);
    expect(row!.revokedAt).not.toBeNull();
  });

  it("an old session cannot be replayed after logout", async () => {
    const first = await issueSession(user.id);
    await revokeAllSessions(user.id);

    const second = await issueSession(user.id);
    await expect(resolveSessionToken(first.token)).resolves.toBeNull();
    expect((await resolveSessionToken(second.token))?.user.id).toBe(user.id);
  });

  it("verifies the seeded-style password path used by login", async () => {
    const [row] = await db
      .select({ hash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    expect(await verifyPassword("Str0ng!TestPassword", row!.hash)).toBe(true);
    expect(await verifyPassword("wrong-password", row!.hash)).toBe(false);
  });
});

/**
 * The cookie must actually travel back to the server in every context the app
 * is deployed into. If it does not, the guard sees an anonymous visitor and the
 * redirect loop returns.
 */
describe("session cookie reaches the server in every deployment context", () => {
  const base = {
    secureOverride: null,
    sameSiteOverride: null,
    forwardedProto: null,
    secFetchSite: null,
    secFetchDest: null,
    nodeEnv: "development",
  };

  it("local development over plain http: no Secure, Lax is fine", () => {
    const attrs = resolveCookieAttributes({
      ...base,
      forwardedProto: "http",
      secFetchSite: "same-origin",
      secFetchDest: "document",
    });
    expect(attrs).toEqual({ secure: false, sameSite: "lax" });
  });

  it("hosted preview (cross-site iframe over https): SameSite=None + Secure", () => {
    const attrs = resolveCookieAttributes({
      ...base,
      forwardedProto: "https",
      secFetchSite: "cross-site",
      secFetchDest: "iframe",
    });
    // Lax here would be the redirect-loop bug: stored, then never sent.
    expect(attrs).toEqual({ secure: true, sameSite: "none" });
  });

  it("production behind https, opened directly: Secure + Lax", () => {
    const attrs = resolveCookieAttributes({
      ...base,
      nodeEnv: "production",
      forwardedProto: "https",
      secFetchSite: "none",
      secFetchDest: "document",
    });
    expect(attrs).toEqual({ secure: true, sameSite: "lax" });
  });

  it("never produces a combination a browser would discard", () => {
    // Secure over http → discarded. None without Secure → rejected outright.
    for (const forwardedProto of ["http", "https", null]) {
      for (const secFetchSite of [null, "same-origin", "same-site", "cross-site"]) {
        for (const secFetchDest of [null, "document", "iframe"]) {
          const { secure, sameSite } = resolveCookieAttributes({
            ...base,
            forwardedProto,
            secFetchSite,
            secFetchDest,
          });
          // Over plain http a Secure cookie would be discarded by the browser.
          if (forwardedProto === "http") expect(secure).toBe(false);
          // SameSite=None without Secure is rejected outright by browsers.
          if (sameSite === "none") expect(secure).toBe(true);
        }
      }
    }
  });
});
