import "server-only";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  achievements,
  books,
  calendarEvents,
  concepts,
  courses,
  notes,
  opportunities,
  projects,
  questions,
  semesters,
  skills,
  studySessions,
  tasks,
} from "@/server/db/schema";

export type SearchHit = {
  id: string;
  type:
    | "course"
    | "semester"
    | "task"
    | "project"
    | "book"
    | "note"
    | "concept"
    | "question"
    | "skill"
    | "opportunity"
    | "achievement"
    | "study_session"
    | "event";
  label: string;
  title: string;
  subtitle?: string;
  href: string;
};

const PER_TYPE = 6;

/**
 * Global search (§29). One ILIKE per indexed table, capped per type so a broad
 * query cannot pull the whole database into memory.
 */
export async function globalSearch(userId: string, query: string, limit = 24): Promise<SearchHit[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const pattern = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const hits: SearchHit[] = [];

  const courseRows = await db
    .select({ id: courses.id, code: courses.code, name: courses.name })
    .from(courses)
    .where(and(eq(courses.userId, userId), isNull(courses.archivedAt), or(ilike(courses.code, pattern), ilike(courses.name, pattern))))
    .limit(PER_TYPE);
  for (const row of courseRows) {
    hits.push({ id: row.id, type: "course", label: "Course", title: `${row.code} — ${row.name}`, href: "/academic/courses" });
  }

  const semesterRows = await db
    .select({ id: semesters.id, name: semesters.name, status: semesters.status })
    .from(semesters)
    .where(and(eq(semesters.userId, userId), ilike(semesters.name, pattern)))
    .limit(PER_TYPE);
  for (const row of semesterRows) {
    hits.push({ id: row.id, type: "semester", label: "Semester", title: row.name, subtitle: row.status, href: "/academic/semesters" });
  }

  const taskRows = await db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.archivedAt), ilike(tasks.title, pattern)))
    .limit(PER_TYPE);
  for (const row of taskRows) {
    hits.push({
      id: row.id,
      type: "task",
      label: "Task",
      title: row.title,
      subtitle: `${row.status}${row.dueDate ? ` · due ${row.dueDate}` : ""}`,
      href: "/tasks",
    });
  }

  const projectRows = await db
    .select({ id: projects.id, name: projects.name, status: projects.status })
    .from(projects)
    .where(and(eq(projects.userId, userId), ilike(projects.name, pattern)))
    .limit(PER_TYPE);
  for (const row of projectRows) {
    hits.push({ id: row.id, type: "project", label: "Project", title: row.name, subtitle: row.status, href: "/projects" });
  }

  const bookRows = await db
    .select({ id: books.id, title: books.title, author: books.author, status: books.status })
    .from(books)
    .where(and(eq(books.userId, userId), or(ilike(books.title, pattern), ilike(books.author, pattern))))
    .limit(PER_TYPE);
  for (const row of bookRows) {
    hits.push({
      id: row.id,
      type: "book",
      label: "Book",
      title: row.title,
      subtitle: [row.author, row.status].filter(Boolean).join(" · "),
      href: "/learning/books",
    });
  }

  const noteRows = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.archivedAt), or(ilike(notes.title, pattern), ilike(notes.body, pattern))))
    .limit(PER_TYPE);
  for (const row of noteRows) {
    hits.push({ id: row.id, type: "note", label: "Note", title: row.title, href: "/learning/notes" });
  }

  const conceptRows = await db
    .select({ id: concepts.id, title: concepts.title, status: concepts.status })
    .from(concepts)
    .where(and(eq(concepts.userId, userId), ilike(concepts.title, pattern)))
    .limit(PER_TYPE);
  for (const row of conceptRows) {
    hits.push({ id: row.id, type: "concept", label: "Concept", title: row.title, subtitle: row.status, href: "/learning/polymath" });
  }

  const questionRows = await db
    .select({ id: questions.id, question: questions.question, status: questions.status })
    .from(questions)
    .where(and(eq(questions.userId, userId), ilike(questions.question, pattern)))
    .limit(PER_TYPE);
  for (const row of questionRows) {
    hits.push({ id: row.id, type: "question", label: "Question", title: row.question, subtitle: row.status, href: "/learning/questions" });
  }

  const skillRows = await db
    .select({ id: skills.id, name: skills.name, stage: skills.stage })
    .from(skills)
    .where(and(eq(skills.userId, userId), ilike(skills.name, pattern)))
    .limit(PER_TYPE);
  for (const row of skillRows) {
    hits.push({ id: row.id, type: "skill", label: "Skill", title: row.name, subtitle: row.stage.replace("_", " "), href: "/learning/skills" });
  }

  const opportunityRows = await db
    .select({ id: opportunities.id, name: opportunities.name, type: opportunities.type, status: opportunities.status })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), ilike(opportunities.name, pattern)))
    .limit(PER_TYPE);
  for (const row of opportunityRows) {
    hits.push({ id: row.id, type: "opportunity", label: "Opportunity", title: row.name, subtitle: row.status, href: "/opportunities" });
  }

  const achievementRows = await db
    .select({ id: achievements.id, title: achievements.title, category: achievements.category })
    .from(achievements)
    .where(and(eq(achievements.userId, userId), ilike(achievements.title, pattern)))
    .limit(PER_TYPE);
  for (const row of achievementRows) {
    hits.push({ id: row.id, type: "achievement", label: "Achievement", title: row.title, subtitle: row.category.replace("_", " "), href: "/academic/achievements" });
  }

  const studyRows = await db
    .select({ id: studySessions.id, title: studySessions.title, topic: studySessions.topic, startedAt: studySessions.startedAt })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), or(ilike(studySessions.title, pattern), ilike(studySessions.topic, pattern))))
    .orderBy(desc(studySessions.startedAt))
    .limit(PER_TYPE);
  for (const row of studyRows) {
    hits.push({
      id: row.id,
      type: "study_session",
      label: "Study session",
      title: row.topic ? `${row.title} — ${row.topic}` : row.title,
      subtitle: row.startedAt.toISOString().slice(0, 10),
      href: "/study/history",
    });
  }

  const eventRows = await db
    .select({ id: calendarEvents.id, title: calendarEvents.title, kind: calendarEvents.kind, startsAt: calendarEvents.startsAt })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), isNull(calendarEvents.archivedAt), ilike(calendarEvents.title, pattern)))
    .orderBy(desc(calendarEvents.startsAt))
    .limit(PER_TYPE);
  for (const row of eventRows) {
    hits.push({
      id: row.id,
      type: "event",
      label: "Event",
      title: row.title,
      subtitle: `${row.kind} · ${row.startsAt.toISOString().slice(0, 10)}`,
      href: "/calendar",
    });
  }

  void sql;
  return hits.slice(0, limit);
}
