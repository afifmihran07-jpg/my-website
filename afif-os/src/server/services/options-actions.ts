"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { books, goals, projects, courses } from "@/server/db/schema";
import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";

export type PickerOptions = {
  courses: Array<{ id: string; code: string; name: string; color: string }>;
  books: Array<{ id: string; title: string; author: string | null }>;
  projects: Array<{ id: string; name: string; status: string }>;
  goals: Array<{ id: string; title: string }>;
};

/** The linkable entities used by every "attach to…" select in the UI. */
export async function getOptionsAction(): Promise<ActionResult<PickerOptions>> {
  return safeAction("options", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const userId = record.user.id;

    const [courseRows, bookRows, projectRows, goalRows] = await Promise.all([
      db
        .select({ id: courses.id, code: courses.code, name: courses.name, color: courses.color })
        .from(courses)
        .where(and(eq(courses.userId, userId), isNull(courses.archivedAt)))
        .orderBy(asc(courses.code)),
      db
        .select({ id: books.id, title: books.title, author: books.author })
        .from(books)
        .where(and(eq(books.userId, userId), isNull(books.archivedAt)))
        .orderBy(asc(books.title)),
      db
        .select({ id: projects.id, name: projects.name, status: projects.status })
        .from(projects)
        .where(and(eq(projects.userId, userId), isNull(projects.archivedAt)))
        .orderBy(asc(projects.name)),
      db
        .select({ id: goals.id, title: goals.title })
        .from(goals)
        .where(and(eq(goals.userId, userId), isNull(goals.archivedAt)))
        .orderBy(asc(goals.title)),
    ]);

    return ok({ courses: courseRows, books: bookRows, projects: projectRows, goals: goalRows });
  });
}
