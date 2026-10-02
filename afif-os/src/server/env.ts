import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  SESSION_COOKIE: z.string().min(1).default("afif_os_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 365).default(12),
  DEFAULT_TIMEZONE: z.string().min(1).default("Asia/Dhaka"),
  ALLOW_FIRST_USER_SETUP: z
    .enum(["0", "1"])
    .default("1")
    .transform((v) => v === "1"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment configuration — ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
