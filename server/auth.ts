import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { adminSessions, adminUsers, passwordResetTokens } from "./db/schema";
import { randomToken, recoveryCode, safeEqual, sha256, signValue } from "./crypto";
import { env } from "./env";
import { ApiRequest, ApiResponse, clearCookie, parseCookies, setCookie } from "./http";

const SESSION_COOKIE = "hss_admin_session";
const SETUP_COOKIE = "hss_admin_setup";
const bootstrapFailures = new Map<string, { count: number; lockedUntil: number }>();

function clientKey(req: ApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  return `${Array.isArray(forwarded) ? forwarded[0] : forwarded ?? req.socket?.remoteAddress ?? "unknown"}`;
}

function validPassword(value: string): boolean {
  return value.length >= 12 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

async function createSession(adminId: string, req: ApiRequest, res: ApiResponse) {
  const raw = randomToken();
  const ttlSeconds = env().SESSION_TTL_HOURS * 60 * 60;
  await db.insert(adminSessions).values({
    adminId,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    ipAddress: clientKey(req),
    userAgent: `${req.headers["user-agent"] ?? ""}`,
  });
  setCookie(res, SESSION_COOKIE, raw, { maxAge: ttlSeconds });
}

export async function adminSetupStatus() {
  const [admin] = await db.select({ state: adminUsers.setupState }).from(adminUsers).limit(1);
  return admin?.state ?? "INITIAL_SETUP_REQUIRED";
}

export async function bootstrapLogin(req: ApiRequest, res: ApiResponse, username: string, password: string) {
  const state = await adminSetupStatus();
  if (state === "INITIAL_SETUP_COMPLETED") return { ok: false, status: 401 };

  const key = clientKey(req);
  const limit = bootstrapFailures.get(key);
  if (limit?.lockedUntil && limit.lockedUntil > Date.now()) return { ok: false, status: 429 };

  const userOk = safeEqual(username, env().ADMIN_BOOTSTRAP_USERNAME);
  const passOk = safeEqual(sha256(password), sha256(env().ADMIN_BOOTSTRAP_PASSWORD));
  if (!userOk || !passOk) {
    const count = (limit?.count ?? 0) + 1;
    bootstrapFailures.set(key, {
      count,
      lockedUntil: count >= 5 ? Date.now() + 15 * 60_000 : 0,
    });
    return { ok: false, status: count >= 5 ? 429 : 401 };
  }

  const payload = `${randomToken()}.${Date.now() + 30 * 60_000}`;
  const setupToken = `${payload}.${signValue(payload, env().AUTH_SECRET)}`;
  setCookie(res, SETUP_COOKIE, setupToken, { maxAge: 30 * 60 });
  return { ok: true, status: 200, setupTokenHash: sha256(setupToken) };
}

export async function completeSetup(
  req: ApiRequest,
  res: ApiResponse,
  input: { username: string; password: string; recoveryEmail: string },
) {
  const cookies = parseCookies(req);
  const setupCookie = cookies[SETUP_COOKIE];
  if (!setupCookie) return { ok: false, error: "Setup authorization expired" };
  const segments = setupCookie.split(".");
  if (segments.length !== 3) return { ok: false, error: "Setup authorization expired" };
  const payload = `${segments[0]}.${segments[1]}`;
  const validSignature = safeEqual(signValue(payload, env().AUTH_SECRET), segments[2]);
  const expiresAt = Number(segments[1]);
  if (!validSignature || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return { ok: false, error: "Setup authorization expired" };
  }
  if ((await adminSetupStatus()) === "INITIAL_SETUP_COMPLETED") return { ok: false, error: "Setup already completed" };
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(input.username) || !validPassword(input.password)) {
    return { ok: false, error: "Invalid username or password strength" };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.recoveryEmail)) return { ok: false, error: "Invalid recovery email" };

  const passwordHash = await bcrypt.hash(input.password, 12);
  const code = recoveryCode();
  const codeHash = await bcrypt.hash(code, 12);

  const adminId = await db.transaction(async (tx) => {
    const existing = await tx.select({ id: adminUsers.id }).from(adminUsers).limit(1);
    if (existing.length) throw new Error("SETUP_ALREADY_COMPLETED");
    const [admin] = await tx
      .insert(adminUsers)
      .values({
        username: input.username.toLowerCase(),
        passwordHash,
        recoveryEmail: input.recoveryEmail.toLowerCase(),
        recoveryCodeHash: codeHash,
        setupState: "INITIAL_SETUP_COMPLETED",
      })
      .returning({ id: adminUsers.id });
    return admin.id;
  });

  clearCookie(res, SETUP_COOKIE);
  await createSession(adminId, req, res);
  return { ok: true, recoveryCode: code };
}

export async function login(req: ApiRequest, res: ApiResponse, username: string, password: string) {
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.username, username.toLowerCase())).limit(1);
  const generic = { ok: false, status: 401, error: "Invalid credentials" };
  if (!admin) return generic;
  if (admin.lockedUntil && admin.lockedUntil > new Date()) return { ...generic, status: 429 };

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    const failures = admin.failedLoginAttempts + 1;
    await db
      .update(adminUsers)
      .set({
        failedLoginAttempts: failures,
        lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
        updatedAt: new Date(),
      })
      .where(eq(adminUsers.id, admin.id));
    return { ...generic, status: failures >= 5 ? 429 : 401 };
  }

  await db
    .update(adminUsers)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(adminUsers.id, admin.id));
  await createSession(admin.id, req, res);
  return { ok: true, status: 200 };
}

export async function requireAdmin(req: ApiRequest) {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return null;
  const [session] = await db
    .select({ adminId: adminSessions.adminId, username: adminUsers.username })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.tokenHash, sha256(raw)),
        gt(adminSessions.expiresAt, new Date()),
        isNull(adminSessions.revokedAt),
      ),
    )
    .limit(1);
  return session ?? null;
}

export async function logout(req: ApiRequest, res: ApiResponse) {
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (raw) {
    await db
      .update(adminSessions)
      .set({ revokedAt: new Date() })
      .where(eq(adminSessions.tokenHash, sha256(raw)));
  }
  clearCookie(res, SESSION_COOKIE);
}

export async function requestPasswordReset(email: string) {
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.recoveryEmail, email.toLowerCase())).limit(1);
  if (!admin) return null;
  const raw = randomToken();
  await db.insert(passwordResetTokens).values({
    adminId: admin.id,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });
  return { admin, raw };
}

export async function resetPassword(rawToken: string, newPassword: string) {
  if (!validPassword(newPassword)) return false;
  const tokenHash = sha256(rawToken);
  return db.transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!token) return false;
    await tx
      .update(adminUsers)
      .set({ passwordHash: await bcrypt.hash(newPassword, 12), updatedAt: new Date() })
      .where(eq(adminUsers.id, token.adminId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, token.id));
    await tx.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.adminId, token.adminId));
    return true;
  });
}

export async function changeCredentials(
  adminId: string,
  input: { currentPassword: string; username?: string; password?: string; recoveryEmail?: string },
) {
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId)).limit(1);
  if (!admin || !(await bcrypt.compare(input.currentPassword, admin.passwordHash))) return false;
  if (input.password && !validPassword(input.password)) return false;
  const update: Partial<typeof adminUsers.$inferInsert> = { updatedAt: new Date() };
  if (input.username) update.username = input.username.toLowerCase();
  if (input.password) update.passwordHash = await bcrypt.hash(input.password, 12);
  if (input.recoveryEmail) update.recoveryEmail = input.recoveryEmail.toLowerCase();
  await db.transaction(async (tx) => {
    await tx.update(adminUsers).set(update).where(eq(adminUsers.id, adminId));
    if (input.password) await tx.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.adminId, adminId));
  });
  return true;
}

export async function rotateRecoveryCode(adminId: string, currentPassword: string) {
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId)).limit(1);
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) return null;
  const code = recoveryCode();
  await db
    .update(adminUsers)
    .set({ recoveryCodeHash: await bcrypt.hash(code, 12), updatedAt: new Date() })
    .where(eq(adminUsers.id, adminId));
  return code;
}

export async function recoveryCodeReset(code: string, newPassword: string) {
  if (!validPassword(newPassword)) return false;
  const admins = await db.select().from(adminUsers).where(sql`${adminUsers.recoveryCodeHash} is not null`);
  for (const admin of admins) {
    if (admin.recoveryCodeHash && (await bcrypt.compare(code.toUpperCase(), admin.recoveryCodeHash))) {
      await db.transaction(async (tx) => {
        await tx
          .update(adminUsers)
          .set({
            passwordHash: await bcrypt.hash(newPassword, 12),
            recoveryCodeHash: null,
            updatedAt: new Date(),
          })
          .where(eq(adminUsers.id, admin.id));
        await tx.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.adminId, admin.id));
      });
      return true;
    }
  }
  return false;
}