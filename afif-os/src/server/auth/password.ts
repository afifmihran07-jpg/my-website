import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = 12;

/** A small blocklist of the most common passwords — cheap, meaningful defence. */
const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "letmein1",
  "welcome1",
  "iloveyou",
  "admin123",
  "abc12345",
  "monkey123",
  "football1",
]);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long")
  .refine((value) => /[a-z]/.test(value), "Password must contain a lowercase letter")
  .refine((value) => /[A-Z]/.test(value), "Password must contain an uppercase letter")
  .refine((value) => /[0-9]/.test(value), "Password must contain a number")
  .refine((value) => !COMMON.has(value.toLowerCase()), "Password is too common");

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // A malformed stored hash must never throw into the login flow.
    return false;
  }
}

/**
 * Rejects passwords that merely restate the account's own identifiers.
 * Returns a human message, or null when the password is acceptable.
 */
export function passwordReusesIdentity(
  password: string,
  identity: { username?: string | null; email?: string | null; fullName?: string | null },
): string | null {
  const needle = password.toLowerCase();
  const candidates = [identity.username, identity.email?.split("@")[0], identity.fullName?.split(" ")[0]]
    .filter((v): v is string => Boolean(v && v.length >= 3))
    .map((v) => v.toLowerCase());
  if (candidates.some((c) => needle.includes(c))) {
    return "Password must not contain your username, name or email";
  }
  return null;
}
