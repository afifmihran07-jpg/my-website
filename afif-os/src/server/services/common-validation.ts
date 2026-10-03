import { z } from "zod";

/**
 * Shared Zod building blocks.
 *
 * Every module validates at the server-action boundary with these so that the
 * rules for "what is a date", "what is a reference" and "what is text" are
 * identical everywhere instead of drifting per module.
 */

export const dateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .nullable()
  .optional();

export const timeValue = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the format HH:MM")
  .nullable()
  .optional();

/** Accepts "" or "   " as null so HTML forms don't produce empty-string UUIDs. */
export const uuid = z
  .union([z.string(), z.null()])
  .transform((v) => (v === null || v.trim() === "" ? null : v.trim()))
  .pipe(z.uuid("Not a valid reference").nullable());

export const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const requiredText = (max: number, label: string, min = 1) =>
  z
    .string()
    .trim()
    .min(min, `${label} cannot be empty`)
    .max(max, `${label} must be ${max} characters or fewer`);

/**
 * Optional whole number from an HTML form.
 *
 * A cleared `<input type="number">` submits `""`, which `z.coerce.number()`
 * turns into 0 — so an untouched field used to fail the minimum. Blank means
 * absent, not zero. Refinements rather than `.pipe()` because piping through a
 * second schema fights Zod v4's inferred output type.
 */
export const optionalInt = (min: number, max: number, label: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    // undefined stays undefined: on a partial update an omitted field must mean
    // "leave it alone", not "clear it".
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || (typeof v === "string" && v.trim() === "")) return null;
      return Number(v);
    })
    .refine((v) => v == null || !Number.isNaN(v), `${label} must be a number`)
    .refine((v) => v == null || Number.isInteger(v), `${label} must be a whole number`)
    .refine((v) => v == null || v >= min, `${label} must be at least ${min}`)
    .refine((v) => v == null || v <= max, `${label} must be at most ${max}`);

export const optionalUrl = z
  .string()
  .trim()
  .max(2000, "That URL is too long")
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Enter a valid URL starting with http:// or https://")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const optionalBool = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .transform((v) => v === true || v === "on" || v === "true")
  .optional();

/** Comma-separated input → clean, de-duplicated text[] for the array columns. */
export const tagList = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => {
    const raw = Array.isArray(value) ? value : value.split(",");
    const seen = new Set<string>();
    for (const item of raw) {
      const clean = item.trim().replace(/\s+/g, " ");
      if (clean) seen.add(clean.slice(0, 60));
    }
    return [...seen].slice(0, 20);
  })
  .optional();

export const STAGE_ORDER = ["exposure", "foundation", "working_knowledge", "applied", "advanced"] as const;
export type MasteryStage = (typeof STAGE_ORDER)[number];

export const masteryStage = z.enum(STAGE_ORDER).default("exposure");

export function stageIndex(stage: string): number {
  const found = STAGE_ORDER.indexOf(stage as MasteryStage);
  return found === -1 ? 0 : found;
}

export const STAGE_LABELS: Record<MasteryStage, string> = {
  exposure: "Exposure",
  foundation: "Foundation",
  working_knowledge: "Working Knowledge",
  applied: "Applied",
  advanced: "Advanced",
};

/** Turns a timestamp/date into the wire format client components expect. */
export function iso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : value;
}
