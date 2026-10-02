import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Export & backup (§38).
 *
 * The point is that the user never becomes dependent on this application:
 * everything owned by the account can be pulled out as JSON, and the
 * time-series tables can be pulled as CSV for spreadsheets.
 *
 * Table names below are a fixed allowlist — never derived from user input —
 * and are quoted with `sql.identifier`, so the queries stay parameterised.
 */

const OWNED_TABLES = [
  "semesters",
  "courses",
  "class_schedules",
  "course_resources",
  "assessments",
  "grades",
  "goals",
  "projects",
  "tasks",
  "calendar_events",
  "study_sessions",
  "reminders",
  "reminder_logs",
  "books",
  "reading_sessions",
  "notes",
  "concepts",
  "questions",
  "skills",
  "skill_evidence",
  "knowledge_connections",
  "polymath_domains",
  "opportunities",
  "achievements",
  "certificates",
  "activities",
  "prayer_logs",
  "medications",
  "medication_logs",
  "photos",
  "timeline_events",
  "milestones",
  "monthly_reflections",
  "ai_permissions",
] as const;

/** `reminder_logs` has no user column of its own — it is reached via reminders. */
const JOINED_TABLES: Record<string, { via: string; alias: string }> = {
  reminder_logs: { via: "reminders", alias: "r" },
};

const CSV_TABLES = [
  "tasks",
  "study_sessions",
  "books",
  "achievements",
  "opportunities",
  "prayer_logs",
] as const;

export type CsvTableName = (typeof CSV_TABLES)[number];

export function csvTableNames(): readonly string[] {
  return CSV_TABLES;
}

export type ExportPayload = {
  exportedAt: string;
  formatVersion: 1;
  account: {
    id: string;
    fullName: string;
    username: string;
    email: string;
    timezone: string;
    createdAt: string;
  };
  data: Record<string, unknown[]>;
};

/** Full account export. Password hashes and session tokens are never included. */
export async function exportUserData(userId: string): Promise<ExportPayload> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Account not found");

  const data: Record<string, unknown[]> = {};
  for (const table of OWNED_TABLES) {
    const joined = JOINED_TABLES[table];
    const rows = joined
      ? await db.execute(
          sql`select l.* from ${sql.identifier(table)} l
              join ${sql.identifier(joined.via)} ${sql.raw(joined.alias)} on ${sql.raw(joined.alias)}.id = l.reminder_id
              where ${sql.raw(joined.alias)}.user_id = ${userId}`,
        )
      : await db.execute(sql`select * from ${sql.identifier(table)} where user_id = ${userId}`);
    data[table] = normaliseRows(rows);
  }

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    account: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      timezone: user.timezone,
      createdAt: user.createdAt.toISOString(),
    },
    data,
  };
}

/** Flat CSV for the tables that make sense in a spreadsheet. */
export async function exportCsv(userId: string, tableName: CsvTableName): Promise<string> {
  if (!CSV_TABLES.includes(tableName)) throw new Error("That table cannot be exported as CSV");
  const rows = normaliseRows(
    await db.execute(sql`select * from ${sql.identifier(tableName)} where user_id = ${userId}`),
  ) as Array<Record<string, unknown>>;
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]!);
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => escapeCsv(row[header])).join(","));
  return lines.join("\n");
}

function normaliseRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const candidate = result as { rows?: unknown[] };
  return (candidate?.rows ?? []) as Array<Record<string, unknown>>;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return `"${value.join(";").replace(/"/g, '""')}"`;
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
