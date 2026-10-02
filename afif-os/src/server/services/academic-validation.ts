import "server-only";
import { z } from "zod";

import { optionalText, requiredText } from "@/server/services/common-validation";
import { ACADEMIC_ASSESSMENT_KINDS, RESOURCE_KINDS, SEMESTER_STATUSES } from "@/lib/labels";

/**
 * Validation for the academic management pages.
 *
 * Kept in its own module (not inside the `use server` action file) because a
 * `"use server"` file may only export async functions — a Zod schema or a type
 * alias exported from there breaks at request time, not at compile time.
 */

const dateOnly = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Use the format YYYY-MM-DD")
  .transform((value) => (value === "" ? null : value));

export const semesterStatus = z.enum(SEMESTER_STATUSES);
export const assessmentKind = z.enum(ACADEMIC_ASSESSMENT_KINDS);
export const resourceKind = z.enum(RESOURCE_KINDS);

export const updateSemesterSchema = z.object({
  name: optionalText(80, "Semester name"),
  startDate: dateOnly.optional(),
  endDate: dateOnly.optional(),
  status: semesterStatus.optional(),
  targetCgpa: z
    .union([z.literal(""), z.coerce.number().min(0).max(4)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  notes: optionalText(4000, "Notes"),
  archived: z.boolean().optional(),
});

export const updateCourseSchema = z.object({
  code: optionalText(20, "Course code"),
  name: optionalText(120, "Course name"),
  credits: z
    .union([z.literal(""), z.coerce.number().min(0).max(20)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  faculty: optionalText(80, "Faculty"),
  section: optionalText(20, "Section"),
  color: optionalText(20, "Colour"),
  targetGrade: optionalText(4, "Target grade"),
  archived: z.boolean().optional(),
});

export const createResourceSchema = z.object({
  courseId: z.string().uuid("Choose a course"),
  title: requiredText(160, "Title"),
  url: z
    .string()
    .trim()
    .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Enter a full http(s) link")
    .transform((value) => (value === "" ? null : value)),
  kind: resourceKind.default("link"),
  notes: optionalText(2000, "Notes"),
});

export const updateResourceSchema = createResourceSchema.partial().omit({ courseId: true });

export type UpdateSemesterInput = z.input<typeof updateSemesterSchema>;
export type UpdateCourseInput = z.input<typeof updateCourseSchema>;
export type CreateResourceInput = z.input<typeof createResourceSchema>;
export type UpdateResourceInput = z.input<typeof updateResourceSchema>;


