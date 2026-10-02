import "server-only";
import { z } from "zod";
import { passwordSchema } from "@/server/auth/password";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username must be at most 32 characters")
  .regex(/^[a-z0-9_.]+$/, "Use lowercase letters, numbers, dots and underscores only")
  .refine((v) => !["admin", "root", "null", "undefined"].includes(v), "That username is reserved");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your username or email").max(254),
  password: z.string().min(1, "Enter your password").max(200),
  remember: z.coerce.boolean().default(false),
});

export const setupAccountSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupAccountInput = z.infer<typeof setupAccountSchema>;

/** Maps a ZodError onto the shape the forms render. */
export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? "_form";
    out[key] = [...(out[key] ?? []), issue.message];
  }
  return out;
}
