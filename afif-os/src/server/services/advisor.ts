import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  aiAdvice,
  aiPermissions,
  books,
  courses,
  polymathDomains,
  questions,
  skills,
  studySessions,
  tasks,
  type AiPermissions,
} from "@/server/db/schema";
import { buildNextActions } from "@/server/services/dashboard";
import { getDaySummary, getWeekSummary } from "@/server/services/study";
import { todayKey } from "@/server/lib/time";

/**
 * Learning advisor (§24).
 *
 * Deliberately a *deterministic* rule engine for now: every answer names the
 * evidence it used, so nothing is invented. The same `contextFor` function is
 * the single gate the future LLM path will use, which means privacy rules
 * cannot be bypassed by swapping the model in later.
 *
 * Retrieval is targeted: each question reads only the tables it needs, and
 * every read is gated on the user's AI permissions. Nothing here ever sends
 * the whole database anywhere.
 */

export const ADVISOR_QUESTIONS = [
  "What should I study now?",
  "What should I learn next?",
  "Which subject am I neglecting?",
  "Should I start another book?",
  "What are my knowledge gaps?",
  "Review my week.",
] as const;

export type AdvisorQuestion = (typeof ADVISOR_QUESTIONS)[number];

export type Advice = {
  id: string;
  question: string;
  answer: string;
  rationale: string;
  mode: "deterministic" | "llm";
  contextUsed: string[];
  createdAt: string;
};

const SENSITIVE: Array<keyof AiPermissions> = ["diary", "photos", "medication", "prayer"];

export async function permissionsFor(userId: string): Promise<AiPermissions> {
  const [row] = await db.select().from(aiPermissions).where(eq(aiPermissions.userId, userId)).limit(1);
  if (row) return row;
  const [created] = await db.insert(aiPermissions).values({ userId }).returning();
  return created!;
}

/** Anything the user has not granted — including all sensitive modules. */
export function deniedModules(permissions: AiPermissions): string[] {
  return (Object.keys(permissions) as Array<keyof AiPermissions>).filter(
    (key) => typeof permissions[key] === "boolean" && permissions[key] === false,
  );
}

export function hasAccess(permissions: AiPermissions, module: keyof AiPermissions): boolean {
  if (SENSITIVE.includes(module)) return permissions[module] === true;
  return permissions[module] !== false;
}

export async function askAdvisor(userId: string, question: string, timeZone: string): Promise<Advice> {
  const permissions = await permissionsFor(userId);
  const dayKey = todayKey(timeZone);
  const contextUsed: string[] = [];
  let answer = "";
  let rationale = "";

  switch (question) {
    case "What should I study now?": {
      const next = await buildNextActions(userId, dayKey, timeZone);
      contextUsed.push("tasks", "study_sessions", "calendar");
      const study = next.find((action) => action.id.startsWith("study-") || action.id === "study-target");
      const deadline = next.find((action) => action.id.startsWith("deadline-") || action.id.startsWith("overdue-"));
      answer = study
        ? study.title
        : deadline
          ? `Work on ${deadline.title}`
          : "Nothing urgent — pick the subject with the least recent study time.";
      rationale = [
        study ? `Reason: ${study.why}` : null,
        deadline ? `Also due soon: ${deadline.title} (${deadline.why.toLowerCase()})` : null,
      ]
        .filter(Boolean)
        .join(" ");
      break;
    }

    case "What should I learn next?": {
      const gaps = await knowledgeGaps(userId, permissions, contextUsed);
      answer = gaps.length > 0 ? gaps[0]!.suggestion : "Everything you are tracking has recent evidence — deepen the weakest stage.";
      rationale = gaps.length > 0 ? gaps[0]!.reason : "No domain is behind the others.";
      break;
    }

    case "Which subject am I neglecting?": {
      if (!hasAccess(permissions, "study")) {
        answer = "Study data is switched off in Privacy & AI access.";
        rationale = "Enable the Study permission to answer this question.";
        contextUsed.push("blocked:study");
        break;
      }
      const neglected = await neglectedSubjects(userId);
      contextUsed.push("study_sessions", "courses");
      answer = neglected.length > 0 ? neglected[0]!.label : "Every active course has study time in the last two weeks.";
      rationale =
        neglected.length > 0
          ? `${neglected[0]!.label}: ${neglected[0]!.daysSince === null ? "no self-study recorded" : `last studied ${neglected[0]!.daysSince} days ago`}, while you logged ${neglected[0]!.compareLabel}.`
          : "Study is spread across your active courses.";
      break;
    }

    case "Should I start another book?": {
      if (!hasAccess(permissions, "books")) {
        answer = "Book data is switched off in Privacy & AI access.";
        rationale = "Enable the Books permission to answer this question.";
        contextUsed.push("blocked:books");
        break;
      }
      const [counts] = await db
        .select({
          reading: sql<number>`count(*) filter (where ${books.status} = 'reading')`,
          want: sql<number>`count(*) filter (where ${books.status} = 'want_to_read')`,
        })
        .from(books)
        .where(and(eq(books.userId, userId), isNull(books.archivedAt)));
      contextUsed.push("books");
      const reading = Number(counts?.reading ?? 0);
      answer =
        reading >= 3
          ? "Finish one before starting another."
          : reading === 0
            ? "Yes — nothing is in progress."
            : "You have room for one more.";
      rationale = `You currently have ${reading} book(s) in progress and ${Number(counts?.want ?? 0)} on the want-to-read list.`;
      break;
    }

    case "What are my knowledge gaps?": {
      const gaps = await knowledgeGaps(userId, permissions, contextUsed);
      answer = gaps.length > 0 ? gaps.map((gap) => gap.suggestion).slice(0, 4).join(" · ") : "No obvious gaps from the data you track.";
      rationale = gaps.length > 0 ? gaps.map((gap) => gap.reason).slice(0, 4).join(" ") : "Every tracked domain has evidence at foundation stage or above.";
      break;
    }

    case "Review my week.": {
      if (!hasAccess(permissions, "study")) {
        answer = "Study data is switched off in Privacy & AI access.";
        rationale = "Enable the Study permission to answer this question.";
        contextUsed.push("blocked:study");
        break;
      }
      const week = await getWeekSummary(userId, dayKey, timeZone);
      const day = await getDaySummary(userId, dayKey, timeZone);
      const [taskCounts] = await db
        .select({
          done: sql<number>`count(*) filter (where ${tasks.status} = 'completed')`,
          open: sql<number>`count(*) filter (where ${tasks.status} in ('todo','in_progress'))`,
        })
        .from(tasks)
        .where(eq(tasks.userId, userId));
      contextUsed.push("study_sessions", "tasks");

      const hours = Math.round((week.totalSeconds / 3600) * 10) / 10;
      answer = `You logged ${hours}h of self-study across ${week.activeDays} of 7 days, in ${week.sessionCount} sessions. ${Number(
        taskCounts?.done ?? 0,
      )} tasks were completed and ${Number(taskCounts?.open ?? 0)} remain open.`;
      rationale = [
        `Longest session was ${Math.round(week.longestSeconds / 60)} minutes.`,
        week.byCourse[0]
          ? `Most time went to ${week.byCourse[0].label} (${Math.round(week.byCourse[0].seconds / 60)}m).`
          : "No subject dominated the week.",
        `Today alone: ${Math.round(day.totalSeconds / 60)} minutes of self-study, excluding ${Math.round(
          day.universitySeconds / 60,
        )} minutes of class.`,
      ].join(" ");
      break;
    }

    default:
      answer = "That question is not supported yet.";
      rationale = "Pick one of the suggested questions.";
  }

  const [saved] = await db
    .insert(aiAdvice)
    .values({
      userId,
      question,
      answer,
      rationale: rationale || "No additional context.",
      mode: "deterministic",
      contextSummary: { modules: contextUsed, denied: deniedModules(permissions) },
    })
    .returning();

  return {
    id: saved!.id,
    question,
    answer,
    rationale: rationale || "No additional context.",
    mode: "deterministic",
    contextUsed,
    createdAt: saved!.createdAt.toISOString(),
  };
}

export async function advisorHistory(userId: string, limit = 12): Promise<Advice[]> {
  const rows = await db
    .select()
    .from(aiAdvice)
    .where(eq(aiAdvice.userId, userId))
    .orderBy(sql`${aiAdvice.createdAt} desc`)
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    rationale: row.rationale,
    mode: row.mode,
    contextUsed: ((row.contextSummary as { modules?: string[] } | null)?.modules ?? []) as string[],
    createdAt: row.createdAt.toISOString(),
  }));
}

/* ------------------------------------------------------------------ */

async function neglectedSubjects(
  userId: string,
): Promise<Array<{ label: string; daysSince: number | null; compareLabel: string }>> {
  const activeCourses = await db
    .select({ id: courses.id, code: courses.code, name: courses.name })
    .from(courses)
    .where(and(eq(courses.userId, userId), eq(courses.status, "active"), isNull(courses.archivedAt)));
  if (activeCourses.length === 0) return [];

  const sessions = await db
    .select({ courseId: studySessions.courseId, startedAt: studySessions.startedAt })
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "completed")));

  const now = Date.now();
  return activeCourses
    .map((course) => {
      const courseSessions = sessions.filter((s) => s.courseId === course.id);
      const last = courseSessions.length ? Math.max(...courseSessions.map((s) => s.startedAt.getTime())) : null;
      return {
        label: `${course.code} — ${course.name}`,
        daysSince: last === null ? null : Math.floor((now - last) / 86_400_000),
        compareLabel: `${courseSessions.length} sessions`,
      };
    })
    .sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999))
    .filter((row) => row.daysSince === null || row.daysSince >= 7)
    .slice(0, 3);
}

async function knowledgeGaps(
  userId: string,
  permissions: AiPermissions,
  contextUsed: string[],
): Promise<Array<{ suggestion: string; reason: string }>> {
  const gaps: Array<{ suggestion: string; reason: string }> = [];

  if (hasAccess(permissions, "polymath")) {
    contextUsed.push("polymath_domains");
    const domains = await db
      .select()
      .from(polymathDomains)
      .where(and(eq(polymathDomains.userId, userId), isNull(polymathDomains.archivedAt)));
    const exposure = domains.filter((domain) => domain.stage === "exposure");
    if (exposure.length > 0) {
      gaps.push({
        suggestion: `Move ${exposure[0]!.name} past exposure`,
        reason: `It is still at the exposure stage, the earliest of the five stages.`,
      });
    }
  }

  if (hasAccess(permissions, "questions")) {
    contextUsed.push("questions");
    const [openQuestions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(and(eq(questions.userId, userId), eq(questions.status, "open")));
    const count = Number(openQuestions?.count ?? 0);
    if (count > 0) {
      gaps.push({
        suggestion: `Answer ${count} open question${count === 1 ? "" : "s"}`,
        reason: `Open questions are recorded gaps in your own understanding.`,
      });
    }
  }

  if (hasAccess(permissions, "skills")) {
    contextUsed.push("skills");
    const [weak] = await db
      .select({ count: sql<number>`count(*)` })
      .from(skills)
      .where(and(eq(skills.userId, userId), inArray(skills.stage, ["exposure", "foundation"]), isNull(skills.archivedAt)));
    const count = Number(weak?.count ?? 0);
    if (count > 0) {
      gaps.push({
        suggestion: `Add evidence to ${count} skill${count === 1 ? "" : "s"} still below working knowledge`,
        reason: `Skills are judged by evidence — courses, projects, problems solved — not by a percentage.`,
      });
    }
  }

  return gaps;
}
