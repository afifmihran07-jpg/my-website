import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { hashToken, randomToken } from "@/server/auth/crypto";
import { hashPassword, passwordReusesIdentity, passwordSchema, verifyPassword } from "@/server/auth/password";
import {
  checkLoginAllowed,
  registerFailedLogin,
  registerSuccessfulLogin,
  resetRateLimitWindow,
} from "@/server/auth/rate-limit";
import { publicUser, resolveSessionToken, revokeAllSessions } from "@/server/auth/session";
import { cleanupUser, makeUser, uniqueKey } from "./helpers";
import type { User } from "@/server/db/schema";

let user: User;

beforeAll(async () => {
  user = await makeUser("auth");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("passwords", () => {
  it("hashes with bcrypt and verifies the original", async () => {
    const hash = await hashPassword("Sup3r!Secret");
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(hash).not.toContain("Sup3r!Secret");
    await expect(verifyPassword("Sup3r!Secret", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("Sup3r!Secret");
    await expect(verifyPassword("Sup3r!SecreT", hash)).resolves.toBe(false);
  });

  it("never throws on a corrupt stored hash", async () => {
    await expect(verifyPassword("anything", "not-a-bcrypt-hash")).resolves.toBe(false);
  });

  it("enforces the password policy", () => {
    expect(passwordSchema.safeParse("short1A").success).toBe(false);
    expect(passwordSchema.safeParse("alllowercase1").success).toBe(false);
    expect(passwordSchema.safeParse("ALLUPPERCASE1").success).toBe(false);
    expect(passwordSchema.safeParse("NoDigitsHere").success).toBe(false);
    expect(passwordSchema.safeParse("password123").success).toBe(false);
    expect(passwordSchema.safeParse("Sup3r!Secret").success).toBe(true);
  });

  it("rejects a password that reuses the username or email", () => {
    const identity = { username: "afif", email: "afif@example.com", fullName: "Afif Mihran" };
    expect(passwordReusesIdentity("MyAfifPass1", identity)).toBeTruthy();
    expect(passwordReusesIdentity("Str0ng!Unrelated", identity)).toBeNull();
  });
});

describe("sessions", () => {
  it("resolves a live token to its user", async () => {
    const token = randomToken();
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600_000),
      remember: false,
    });

    const record = await resolveSessionToken(token);
    expect(record?.user.id).toBe(user.id);
  });

  it("rejects an expired session", async () => {
    const token = randomToken();
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(resolveSessionToken(token)).resolves.toBeNull();
  });

  it("rejects a revoked session (logout)", async () => {
    const token = randomToken();
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    expect(await resolveSessionToken(token)).not.toBeNull();

    await revokeAllSessions(user.id);
    await expect(resolveSessionToken(token)).resolves.toBeNull();
  });

  it("rejects an unknown or empty token", async () => {
    await expect(resolveSessionToken(randomToken())).resolves.toBeNull();
    await expect(resolveSessionToken(undefined)).resolves.toBeNull();
    await expect(resolveSessionToken("")).resolves.toBeNull();
  });

  it("never exposes the password hash to clients", async () => {
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const serialised = publicUser(row!) as Record<string, unknown>;
    expect(serialised.passwordHash).toBeUndefined();
    expect(JSON.stringify(serialised)).not.toContain(row!.passwordHash);
    expect(serialised.username).toBe(row!.username);
  });
});

describe("login rate limiting", () => {
  it("locks the account after repeated failures and clears on success", async () => {
    resetRateLimitWindow();
    const identifier = user.username;
    const ip = `10.0.0.${Math.floor(Math.random() * 200) + 20}`;

    expect((await checkLoginAllowed(ip, identifier)).allowed).toBe(true);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await registerFailedLogin({ ip, identifier, userId: user.id, userAgent: "vitest" });
    }

    const [locked] = await db.select({ lockedUntil: users.lockedUntil }).from(users).where(eq(users.id, user.id)).limit(1);
    expect(locked?.lockedUntil).not.toBeNull();
    expect(locked!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    const decision = await checkLoginAllowed(ip, identifier);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.retryAfterSeconds).toBeGreaterThan(0);

    await registerSuccessfulLogin({ ip, identifier, userId: user.id, userAgent: "vitest" });
    const [cleared] = await db
      .select({ lockedUntil: users.lockedUntil, failed: users.failedLoginAttempts })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    expect(cleared?.lockedUntil).toBeNull();
    expect(cleared?.failed).toBe(0);
  });

  it("rate limits by IP even for an unknown identifier", async () => {
    const ip = `10.1.0.${Math.floor(Math.random() * 200) + 20}`;
    const identifier = uniqueKey("nobody");
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await registerFailedLogin({ ip, identifier, userId: null });
    }
    const decision = await checkLoginAllowed(ip, identifier);
    expect(decision.allowed).toBe(false);
  });
});
