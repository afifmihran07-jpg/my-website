"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";
import { clientIp, fail, ok, safeAction, userAgent, type ActionResult } from "@/server/lib/action";
import { verifyPassword } from "@/server/auth/password";
import { passwordReusesIdentity } from "@/server/auth/password";
import { checkLoginAllowed, registerFailedLogin, registerSuccessfulLogin } from "@/server/auth/rate-limit";
import { createSession, destroyCurrentSession, revokeAllSessions } from "@/server/auth/session";
import { loginSchema, setupAccountSchema, fieldErrors } from "@/server/auth/validation";
import { createAccount, ensureAiPermissions, hasAnyAccount, findUserByIdentifier } from "@/server/services/account";

const GENERIC_AUTH_ERROR = "Incorrect username or password";

/**
 * Used to keep response timing uniform when the account does not exist.
 * Never matches a real password.
 */
const DECOY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO1uQ0eSbGvL8j1mZQxJ0nJZ0k0y0y0y0";

export async function loginAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string; fullName: string }>> {
  return safeAction("login", async () => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Check the form and try again", fieldErrors(parsed.error));
    }
    const { identifier, password, remember } = parsed.data;
    const ip = await clientIp();
    const agent = await userAgent();

    const gate = await checkLoginAllowed(ip, identifier);
    if (!gate.allowed) {
      const minutes = Math.max(1, Math.ceil(gate.retryAfterSeconds / 60));
      return fail(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
    }

    const user = await findUserByIdentifier(identifier);
    // Always run a comparison so timing does not reveal whether the account exists.
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DECOY_HASH);

    if (!user || !passwordOk) {
      await registerFailedLogin({ ip, identifier, userAgent: agent, userId: user?.id ?? null });
      return fail(GENERIC_AUTH_ERROR);
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      return fail(`Account temporarily locked. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
    }

    await registerSuccessfulLogin({ ip, identifier, userAgent: agent, userId: user.id });
    await ensureAiPermissions(user.id);
    await createSession(user.id, { remember, userAgent: agent, ipAddress: ip });

    return ok({ redirectTo: "/dashboard", fullName: user.fullName });
  });
}

/** First-run account creation. Disabled once an account exists. */
export async function setupAccountAction(
  input: unknown,
): Promise<ActionResult<{ redirectTo: string }>> {
  return safeAction("setup", async () => {
    if (!env().ALLOW_FIRST_USER_SETUP) {
      return fail("Account setup is disabled on this deployment.");
    }
    if (await hasAnyAccount()) {
      return fail("An account already exists. Please sign in instead.");
    }

    const parsed = setupAccountSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Check the form and try again", fieldErrors(parsed.error));
    }
    const data = parsed.data;

    const identityIssue = passwordReusesIdentity(data.password, {
      username: data.username,
      email: data.email,
      fullName: data.fullName,
    });
    if (identityIssue) {
      return fail("Check the form and try again", { password: [identityIssue] });
    }

    try {
      const user = await createAccount({
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        password: data.password,
      });
      await createSession(user.id, { remember: true, userAgent: await userAgent(), ipAddress: await clientIp() });
      return ok({ redirectTo: "/dashboard" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Account creation failed";
      if (message.includes("already in use")) {
        return fail("Check the form and try again", { username: [message] });
      }
      throw error;
    }
  });
}

export async function logoutAction(): Promise<ActionResult<{ redirectTo: string }>> {
  return safeAction("logout", async () => {
    await destroyCurrentSession();
    return ok({ redirectTo: "/login?reason=logged_out" });
  });
}

/** Signs the user out everywhere (used from Settings → Security). */
export async function logoutEverywhereAction(): Promise<ActionResult<{ redirectTo: string }>> {
  return safeAction("logout-everywhere", async () => {
    const { getSessionUser } = await import("@/server/auth/session");
    const record = await getSessionUser();
    if (record) await revokeAllSessions(record.user.id);
    await destroyCurrentSession();
    return ok({ redirectTo: "/login?reason=logged_out" });
  });
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  return safeAction("change-password", async () => {
    const { getSessionUser } = await import("@/server/auth/session");
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in to do that.");

    const schema = setupAccountSchema.shape;
    const parsedNew = schema.password.safeParse(input.newPassword);
    if (!parsedNew.success) {
      return fail("Check the form and try again", fieldErrors(parsedNew.error));
    }
    if (input.newPassword !== input.confirmPassword) {
      return fail("Check the form and try again", { confirmPassword: ["Passwords do not match"] });
    }
    const valid = await verifyPassword(input.currentPassword, record.user.passwordHash);
    if (!valid) {
      return fail("Check the form and try again", { currentPassword: ["Current password is incorrect"] });
    }

    const { hashPassword } = await import("@/server/auth/password");
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(input.newPassword) })
      .where(eq(users.id, record.user.id));
    // Other devices must not keep working with the old password.
    await revokeAllSessions(record.user.id);
    await createSession(record.user.id, { remember: true, userAgent: await userAgent(), ipAddress: await clientIp() });

    return ok(undefined);
  });
}

/** Server-side redirect helper for protected entry points. */
export async function redirectToLogin(): Promise<never> {
  redirect("/login");
}
