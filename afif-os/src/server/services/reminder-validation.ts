import "server-only";
import { z } from "zod";

/**
 * Reminder validation, kept outside the `"use server"` module because Next
 * requires every export of a server-action file to be an async function.
 */
export const createReminderSchema = z.object({
  title: z.string().trim().min(2, "Give the reminder a title").max(180),
  description: z.string().trim().max(2000).nullable().optional(),
  /** local wall-clock time in the user's timezone */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Pick a time"),
  recurrence: z.enum(["none", "daily", "weekly", "monthly", "custom"]).default("none"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
