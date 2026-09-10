import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  ADMIN_BOOTSTRAP_USERNAME: z.string().min(3),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12),
  APP_URL: z.string().url(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SMS_PROVIDER: z.enum(["greenweb", "reve", "unconfigured"]).default("unconfigured"),
  SMS_API_URL: optionalUrl,
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  BKASH_NUMBER: z.string().default("0187966502"),
  NAGAD_NUMBER: z.string().default("0187966502"),
  FACEBOOK_URL: z.string().url().default("https://www.facebook.com/profile.php?id=61583748077350"),
  INSTAGRAM_URL: z.string().url().default("https://www.instagram.com/highstreetsoociety?stkn=bGt3MmE3MTZ2ZzB1"),
});

let cached: z.infer<typeof envSchema> | undefined;

export function env() {
  if (!cached) cached = envSchema.parse(process.env);
  return cached;
}