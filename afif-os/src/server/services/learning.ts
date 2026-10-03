import "server-only";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/server/db";
import {
  books,
  concepts,
  courses,
  knowledgeConnections,
  notes,
  polymathDomains,
  projects,
  questions,
  readingSessions,
  skillEvidence,
  skills,
  studySessions,
  users,
  type Concept,
  type KnowledgeConnection,
  type Note,
  type PolymathDomain,
  type Question,
  type Skill,
  type SkillEvidence,
} from "@/server/db/schema";
import { STAGE_ORDER } from "@/server/services/common-validation";

/* -------------------------------------------------------------------------- */
/* polymath domains                                                            */
/* -------------------------------------------------------------------------- */

export type DomainWithCounts = PolymathDomain & {
  bookCount: number;
  conceptCount: number;
  questionCount: number;
  skillCount: number;
  noteCount: number;
  /** deliberate study-timer time on books in this domain */
  studySeconds: number;
  /** time logged while reading books in this domain */
  readingSeconds: number;
  children: DomainWithCounts[];
};

async function loadDomains(userId: string, includeArchived = false) {
  // The table is aliased and the correlated reference is written by hand.
  // Without a join in the outer query drizzle renders both sides of the
  // subquery predicate unqualified (`where domain_id = id`), which resolves
  // *inside* the subquery — comparing concepts to itself — and silently counts
  // zero. Qualifying the outer column by name makes the correlation explicit.
  const domain = alias(polymathDomains, "d");
  const domainId = sql.raw(`"d"."id"`);

  const conditions = [eq(domain.userId, userId)];
  if (!includeArchived) conditions.push(isNull(domain.archivedAt));

  const rows = await db
    .select({
      domain,
      bookCount: sql<number>`(select count(*) from ${books} where ${books.domainId} = ${domainId} and ${books.archivedAt} is null)`,
      conceptCount: sql<number>`(select count(*) from ${concepts} where ${concepts.domainId} = ${domainId})`,
      questionCount: sql<number>`(select count(*) from ${questions} where ${questions.domainId} = ${domainId} and ${questions.archivedAt} is null)`,
      skillCount: sql<number>`(select count(*) from ${skills} where ${skills.domainId} = ${domainId} and ${skills.archivedAt} is null)`,
      noteCount: sql<number>`(select count(*) from ${notes} where ${notes.domainId} = ${domainId} and ${notes.archivedAt} is null)`,
    })
    .from(domain)
    .where(and(...conditions))
    .orderBy(domain.sortOrder, domain.name);

  return rows.map(({ domain, bookCount, conceptCount, questionCount, skillCount, noteCount }) => ({
    ...domain,
    bookCount: Number(bookCount),
    conceptCount: Number(conceptCount),
    questionCount: Number(questionCount),
    skillCount: Number(skillCount),
    noteCount: Number(noteCount),
    studySeconds: 0,
    readingSeconds: 0,
    children: [] as DomainWithCounts[],
  }));
}

/**
 * Time attributed to a domain through its books.
 *
 * Study-timer time and reading time are kept separate: a 90-minute reading
 * session is not the same activity as 90 minutes of deliberate study, and
 * merging them would make both numbers meaningless.
 */
async function domainTime(userId: string, domainIds: string[]) {
  const study = new Map<string, number>();
  const reading = new Map<string, number>();
  if (domainIds.length === 0) return { study, reading };

  const studyRows = await db
    .select({
      domainId: books.domainId,
      total: sql<number>`coalesce(sum(${studySessions.durationSeconds}), 0)`,
    })
    .from(studySessions)
    .innerJoin(books, eq(books.id, studySessions.bookId))
    .where(
      and(
        eq(studySessions.userId, userId),
        eq(studySessions.status, "completed"),
        inArray(books.domainId, domainIds),
      ),
    )
    .groupBy(books.domainId);
  for (const row of studyRows) if (row.domainId) study.set(row.domainId, Number(row.total));

  const readingRows = await db
    .select({
      domainId: books.domainId,
      total: sql<number>`coalesce(sum(${readingSessions.durationSeconds}), 0)`,
    })
    .from(readingSessions)
    .innerJoin(books, eq(books.id, readingSessions.bookId))
    .where(and(eq(readingSessions.userId, userId), inArray(books.domainId, domainIds)))
    .groupBy(books.domainId);
  for (const row of readingRows) if (row.domainId) reading.set(row.domainId, Number(row.total));

  return { study, reading };
}

export async function listDomains(userId: string): Promise<DomainWithCounts[]> {
  const flat = await loadDomains(userId);
  const { study, reading } = await domainTime(
    userId,
    flat.map((domain) => domain.id),
  );
  for (const domain of flat) {
    domain.studySeconds = study.get(domain.id) ?? 0;
    domain.readingSeconds = reading.get(domain.id) ?? 0;
  }

  const byId = new Map(flat.map((domain) => [domain.id, domain]));
  const roots: DomainWithCounts[] = [];
  for (const domain of flat) {
    const parent = domain.parentId ? byId.get(domain.parentId) : undefined;
    if (parent) parent.children.push(domain);
    else roots.push(domain);
  }
  return roots;
}

export async function flattenDomains(userId: string) {
  const flat = await loadDomains(userId);
  return flat.map(({ children: _children, ...domain }) => domain);
}

export async function createDomain(input: {
  userId: string;
  name: string;
  category?: PolymathDomain["category"];
  stage?: PolymathDomain["stage"];
  summary?: string | null;
  parentId?: string | null;
  sortOrder?: number | null;
}): Promise<PolymathDomain> {
  const [row] = await db
    .insert(polymathDomains)
    .values({
      userId: input.userId,
      name: input.name.trim(),
      category: input.category ?? "other",
      stage: input.stage ?? "exposure",
      summary: input.summary?.trim() || null,
      parentId: input.parentId || null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row!;
}

export async function updateDomain(
  userId: string,
  domainId: string,
  patch: Partial<{
    name: string;
    category: PolymathDomain["category"];
    stage: PolymathDomain["stage"];
    summary: string | null;
    parentId: string | null;
    sortOrder: number | null;
    archived: boolean;
  }>,
): Promise<PolymathDomain | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.category !== undefined) values.category = patch.category;
  if (patch.stage !== undefined) values.stage = patch.stage;
  if (patch.summary !== undefined) values.summary = patch.summary?.trim() || null;
  if (patch.parentId !== undefined) values.parentId = patch.parentId || null;
  if (patch.sortOrder !== undefined) values.sortOrder = patch.sortOrder ?? 0;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  const [row] = await db
    .update(polymathDomains)
    .set(values)
    .where(and(eq(polymathDomains.userId, userId), eq(polymathDomains.id, domainId)))
    .returning();
  return row ?? null;
}

export const DOMAIN_CATEGORIES: PolymathDomain["category"][] = [
  "stem",
  "business",
  "human_sciences",
  "creation",
  "life_nature",
  "other",
];

/* -------------------------------------------------------------------------- */
/* concepts                                                                    */
/* -------------------------------------------------------------------------- */

export type ConceptWithLinks = Concept & {
  domainName: string | null;
  courseName: string | null;
  bookTitle: string | null;
  noteCount: number;
  questionCount: number;
};

export async function listConcepts(userId: string, filter: { status?: Concept["status"] | "all"; domainId?: string } = {}) {
  const conditions = [eq(concepts.userId, userId)];
  if (filter.status && filter.status !== "all") conditions.push(eq(concepts.status, filter.status));
  if (filter.domainId) conditions.push(eq(concepts.domainId, filter.domainId));

  const rows = await db
    .select({
      concept: concepts,
      domainName: polymathDomains.name,
      courseName: courses.name,
      bookTitle: books.title,
      noteCount: sql<number>`(select count(*) from ${notes} where ${notes.conceptId} = ${concepts.id} and ${notes.archivedAt} is null)`,
      questionCount: sql<number>`(select count(*) from ${questions} where ${questions.conceptId} = ${concepts.id} and ${questions.archivedAt} is null)`,
    })
    .from(concepts)
    .leftJoin(polymathDomains, eq(polymathDomains.id, concepts.domainId))
    .leftJoin(courses, eq(courses.id, concepts.courseId))
    .leftJoin(books, eq(books.id, concepts.bookId))
    .where(and(...conditions))
    .orderBy(desc(concepts.updatedAt));

  return rows.map(({ concept, domainName, courseName, bookTitle, noteCount, questionCount }) => ({
    ...concept,
    domainName,
    courseName,
    bookTitle,
    noteCount: Number(noteCount),
    questionCount: Number(questionCount),
  })) satisfies ConceptWithLinks[];
}

export async function createConcept(input: {
  userId: string;
  title: string;
  summary?: string | null;
  domainId?: string | null;
  courseId?: string | null;
  bookId?: string | null;
  status?: Concept["status"];
}): Promise<Concept> {
  const [row] = await db
    .insert(concepts)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      domainId: input.domainId || null,
      courseId: input.courseId || null,
      bookId: input.bookId || null,
      status: input.status ?? "new",
    })
    .returning();
  return row!;
}

export async function updateConcept(
  userId: string,
  conceptId: string,
  patch: Partial<{
    title: string;
    summary: string | null;
    domainId: string | null;
    courseId: string | null;
    bookId: string | null;
    status: Concept["status"];
  }>,
): Promise<Concept | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title.trim();
  if (patch.summary !== undefined) values.summary = patch.summary?.trim() || null;
  if (patch.domainId !== undefined) values.domainId = patch.domainId || null;
  if (patch.courseId !== undefined) values.courseId = patch.courseId || null;
  if (patch.bookId !== undefined) values.bookId = patch.bookId || null;
  if (patch.status !== undefined) values.status = patch.status;

  const [row] = await db
    .update(concepts)
    .set(values)
    .where(and(eq(concepts.userId, userId), eq(concepts.id, conceptId)))
    .returning();
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/* questions                                                                   */
/* -------------------------------------------------------------------------- */

export type QuestionWithLinks = Question & {
  domainName: string | null;
  courseName: string | null;
  bookTitle: string | null;
  conceptTitle: string | null;
  /** days the question has been open — surfaced so old questions get attention */
  openDays: number;
};

const MS_PER_DAY = 86_400_000;

export async function listQuestions(userId: string, filter: { status?: Question["status"] | "all" } = {}) {
  const conditions = [eq(questions.userId, userId), isNull(questions.archivedAt)];
  if (filter.status && filter.status !== "all") conditions.push(eq(questions.status, filter.status));

  const rows = await db
    .select({
      question: questions,
      domainName: polymathDomains.name,
      courseName: courses.name,
      bookTitle: books.title,
      conceptTitle: concepts.title,
    })
    .from(questions)
    .leftJoin(polymathDomains, eq(polymathDomains.id, questions.domainId))
    .leftJoin(courses, eq(courses.id, questions.courseId))
    .leftJoin(books, eq(books.id, questions.bookId))
    .leftJoin(concepts, eq(concepts.id, questions.conceptId))
    .where(and(...conditions))
    .orderBy(
      sql`case when ${questions.status} = 'open' then 0 when ${questions.status} = 'researching' then 1 else 2 end`,
      desc(questions.createdAt),
    );

  return rows.map(({ question, domainName, courseName, bookTitle, conceptTitle }) => ({
    ...question,
    domainName,
    courseName,
    bookTitle,
    conceptTitle,
    openDays: Math.floor((Date.now() - question.createdAt.getTime()) / MS_PER_DAY),
  })) satisfies QuestionWithLinks[];
}

export async function createQuestion(input: {
  userId: string;
  question: string;
  context?: string | null;
  courseId?: string | null;
  bookId?: string | null;
  conceptId?: string | null;
  domainId?: string | null;
}): Promise<Question> {
  const [row] = await db
    .insert(questions)
    .values({
      userId: input.userId,
      question: input.question.trim(),
      context: input.context?.trim() || null,
      courseId: input.courseId || null,
      bookId: input.bookId || null,
      conceptId: input.conceptId || null,
      domainId: input.domainId || null,
      status: "open",
    })
    .returning();
  return row!;
}

export async function updateQuestion(
  userId: string,
  questionId: string,
  patch: Partial<{
    question: string;
    context: string | null;
    answer: string | null;
    status: Question["status"];
    courseId: string | null;
    bookId: string | null;
    conceptId: string | null;
    domainId: string | null;
    archived: boolean;
  }>,
): Promise<Question | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.question !== undefined) values.question = patch.question.trim();
  if (patch.context !== undefined) values.context = patch.context?.trim() || null;
  if (patch.answer !== undefined) values.answer = patch.answer?.trim() || null;
  if (patch.courseId !== undefined) values.courseId = patch.courseId || null;
  if (patch.bookId !== undefined) values.bookId = patch.bookId || null;
  if (patch.conceptId !== undefined) values.conceptId = patch.conceptId || null;
  if (patch.domainId !== undefined) values.domainId = patch.domainId || null;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  if (patch.status !== undefined) {
    values.status = patch.status;
    // Answered gets a timestamp once; reopening clears it so history is honest.
    if (patch.status === "answered") {
      const [existing] = await db.select({ answeredAt: questions.answeredAt }).from(questions).where(eq(questions.id, questionId)).limit(1);
      values.answeredAt = existing?.answeredAt ?? new Date();
    } else {
      values.answeredAt = null;
    }
  }

  const [row] = await db
    .update(questions)
    .set(values)
    .where(and(eq(questions.userId, userId), eq(questions.id, questionId)))
    .returning();
  return row ?? null;
}

/* -------------------------------------------------------------------------- */
/* notes                                                                       */
/* -------------------------------------------------------------------------- */

export type NoteWithLinks = Note & {
  domainName: string | null;
  courseName: string | null;
  bookTitle: string | null;
  conceptTitle: string | null;
  projectName: string | null;
  connectionCount: number;
};

export async function listNotes(userId: string, filter: { search?: string; tag?: string; includeArchived?: boolean } = {}) {
  const conditions = [eq(notes.userId, userId)];
  if (!filter.includeArchived) conditions.push(isNull(notes.archivedAt));
  if (filter.search && filter.search.trim().length > 0) {
    const needle = filter.search.trim();
    if (needle.length < 2) {
      // Returning everything for a one-character search would look like a
      // match-all. Refuse instead — the caller shows "type at least 2 characters".
      return [];
    }
    const term = `%${escapeLike(needle)}%`;
    conditions.push(or(ilike(notes.title, term), ilike(notes.body, term))!);
  }
  if (filter.tag) conditions.push(sql`${filter.tag} = any(${notes.tags})`);

  const rows = await db
    .select({
      note: notes,
      domainName: polymathDomains.name,
      courseName: courses.name,
      bookTitle: books.title,
      conceptTitle: concepts.title,
      projectName: projects.name,
      connectionCount: sql<number>`(select count(*) from ${knowledgeConnections} where ${knowledgeConnections.userId} = ${notes.userId} and ((${knowledgeConnections.fromType} = 'note' and ${knowledgeConnections.fromId} = ${notes.id}::text) or (${knowledgeConnections.toType} = 'note' and ${knowledgeConnections.toId} = ${notes.id}::text)))`,
    })
    .from(notes)
    .leftJoin(polymathDomains, eq(polymathDomains.id, notes.domainId))
    .leftJoin(courses, eq(courses.id, notes.courseId))
    .leftJoin(books, eq(books.id, notes.bookId))
    .leftJoin(concepts, eq(concepts.id, notes.conceptId))
    .leftJoin(projects, eq(projects.id, notes.projectId))
    .where(and(...conditions))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));

  return rows.map(({ note, domainName, courseName, bookTitle, conceptTitle, projectName, connectionCount }) => ({
    ...note,
    domainName,
    courseName,
    bookTitle,
    conceptTitle,
    projectName,
    connectionCount: Number(connectionCount),
  })) satisfies NoteWithLinks[];
}

export async function noteTags(userId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await db
    .select({ tag: sql<string>`unnest(${notes.tags})`, count: sql<number>`count(*)` })
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.archivedAt)))
    .groupBy(sql`unnest(${notes.tags})`)
    .orderBy(desc(sql`count(*)`))
    .limit(40);

  return rows.map((row) => ({ tag: row.tag, count: Number(row.count) }));
}

export async function createNote(input: {
  userId: string;
  title: string;
  body?: string | null;
  tags?: string[];
  pinned?: boolean;
  courseId?: string | null;
  bookId?: string | null;
  conceptId?: string | null;
  projectId?: string | null;
  domainId?: string | null;
}): Promise<Note> {
  const [row] = await db
    .insert(notes)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      tags: input.tags ?? [],
      pinned: input.pinned ?? false,
      courseId: input.courseId || null,
      bookId: input.bookId || null,
      conceptId: input.conceptId || null,
      projectId: input.projectId || null,
      domainId: input.domainId || null,
    })
    .returning();
  return row!;
}

export async function updateNote(
  userId: string,
  noteId: string,
  patch: Partial<{
    title: string;
    body: string | null;
    tags: string[];
    pinned: boolean;
    courseId: string | null;
    bookId: string | null;
    conceptId: string | null;
    projectId: string | null;
    domainId: string | null;
    archived: boolean;
  }>,
): Promise<Note | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title.trim();
  if (patch.body !== undefined) values.body = patch.body?.trim() || null;
  if (patch.tags !== undefined) values.tags = patch.tags;
  if (patch.pinned !== undefined) values.pinned = patch.pinned;
  if (patch.courseId !== undefined) values.courseId = patch.courseId || null;
  if (patch.bookId !== undefined) values.bookId = patch.bookId || null;
  if (patch.conceptId !== undefined) values.conceptId = patch.conceptId || null;
  if (patch.projectId !== undefined) values.projectId = patch.projectId || null;
  if (patch.domainId !== undefined) values.domainId = patch.domainId || null;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  const [row] = await db
    .update(notes)
    .set(values)
    .where(and(eq(notes.userId, userId), eq(notes.id, noteId)))
    .returning();
  return row ?? null;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/* -------------------------------------------------------------------------- */
/* skills + evidence                                                           */
/* -------------------------------------------------------------------------- */

export type SkillWithEvidence = Skill & {
  domainName: string | null;
  evidenceCount: number;
  evidence: SkillEvidence[];
  /**
   * A transparent suggestion derived from how much evidence exists — shown next
   * to the stage you actually set, never written back automatically and never
   * rendered as a percentage.
   */
  suggestedStage: PolymathDomain["stage"];
  latestEvidenceAt: string | null;
};

/** Evidence thresholds are visible in the UI, so the suggestion is defensible. */
export const STAGE_EVIDENCE_THRESHOLDS = [1, 3, 5, 8] as const;

export function stageFromEvidenceCount(count: number): PolymathDomain["stage"] {
  let stage = 0;
  for (let i = 0; i < STAGE_EVIDENCE_THRESHOLDS.length; i += 1) {
    if (count >= STAGE_EVIDENCE_THRESHOLDS[i]!) stage = i + 1;
  }
  return STAGE_ORDER[Math.min(stage, STAGE_ORDER.length - 1)]!;
}

export async function listSkills(userId: string, includeArchived = false): Promise<SkillWithEvidence[]> {
  const conditions = [eq(skills.userId, userId)];
  if (!includeArchived) conditions.push(isNull(skills.archivedAt));

  const rows = await db
    .select({ skill: skills, domainName: polymathDomains.name })
    .from(skills)
    .leftJoin(polymathDomains, eq(polymathDomains.id, skills.domainId))
    .where(and(...conditions))
    .orderBy(skills.name);

  const ids = rows.map((row) => row.skill.id);
  const evidence = ids.length
    ? await db
        .select()
        .from(skillEvidence)
        .where(and(eq(skillEvidence.userId, userId), inArray(skillEvidence.skillId, ids)))
        .orderBy(desc(skillEvidence.occurredAt), desc(skillEvidence.createdAt))
    : [];

  return rows.map(({ skill, domainName }) => {
    const own = evidence.filter((item) => item.skillId === skill.id);
    const latest = own.map((item) => item.occurredAt).filter(Boolean).sort().reverse()[0] ?? null;
    return {
      ...skill,
      domainName,
      evidence: own,
      evidenceCount: own.length,
      suggestedStage: stageFromEvidenceCount(own.length),
      latestEvidenceAt: latest,
    };
  });
}

export async function createSkill(input: {
  userId: string;
  name: string;
  category?: string | null;
  description?: string | null;
  stage?: Skill["stage"];
  domainId?: string | null;
}): Promise<Skill> {
  const [row] = await db
    .insert(skills)
    .values({
      userId: input.userId,
      name: input.name.trim(),
      category: input.category?.trim() || null,
      description: input.description?.trim() || null,
      stage: input.stage ?? "exposure",
      domainId: input.domainId || null,
    })
    .returning();
  return row!;
}

export async function updateSkill(
  userId: string,
  skillId: string,
  patch: Partial<{
    name: string;
    category: string | null;
    description: string | null;
    stage: Skill["stage"];
    domainId: string | null;
    archived: boolean;
  }>,
): Promise<Skill | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.category !== undefined) values.category = patch.category?.trim() || null;
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  if (patch.stage !== undefined) values.stage = patch.stage;
  if (patch.domainId !== undefined) values.domainId = patch.domainId || null;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  const [row] = await db
    .update(skills)
    .set(values)
    .where(and(eq(skills.userId, userId), eq(skills.id, skillId)))
    .returning();
  return row ?? null;
}

export async function addSkillEvidence(input: {
  userId: string;
  skillId: string;
  kind?: SkillEvidence["kind"];
  title: string;
  metricLabel?: string | null;
  metricValue?: number | null;
  url?: string | null;
  occurredAt?: string | null;
  linkedType?: SkillEvidence["linkedType"];
  linkedId?: string | null;
}): Promise<SkillEvidence | null> {
  // Evidence must belong to a skill the caller owns.
  const [owner] = await db
    .select({ id: skills.id })
    .from(skills)
    .where(and(eq(skills.userId, input.userId), eq(skills.id, input.skillId)))
    .limit(1);
  if (!owner) return null;

  const [row] = await db
    .insert(skillEvidence)
    .values({
      userId: input.userId,
      skillId: input.skillId,
      kind: input.kind ?? "other",
      title: input.title.trim(),
      metricLabel: input.metricLabel?.trim() || null,
      metricValue: input.metricValue ?? null,
      url: input.url?.trim() || null,
      occurredAt: input.occurredAt || new Date().toISOString().slice(0, 10),
      linkedType: input.linkedType ?? "none",
      linkedId: input.linkedId || null,
    })
    .returning();
  return row ?? null;
}

export async function deleteSkillEvidence(userId: string, evidenceId: string): Promise<boolean> {
  const [row] = await db
    .delete(skillEvidence)
    .where(and(eq(skillEvidence.userId, userId), eq(skillEvidence.id, evidenceId)))
    .returning({ id: skillEvidence.id });
  return Boolean(row);
}

/* -------------------------------------------------------------------------- */
/* knowledge connections                                                       */
/* -------------------------------------------------------------------------- */

export const CONNECTABLE_TYPES = [
  "course",
  "book",
  "project",
  "goal",
  "note",
  "concept",
  "question",
  "skill",
  "domain",
  "opportunity",
  "achievement",
] as const;

export type ConnectableType = (typeof CONNECTABLE_TYPES)[number];

export const RELATIONS = [
  "relates_to",
  "depends_on",
  "supports",
  "contradicts",
  "example_of",
  "led_to",
  "part_of",
] as const;

export type ConnectionWithLabels = KnowledgeConnection & {
  fromLabel: string;
  toLabel: string;
};

/** Resolves the human label for a linked entity, returning null when missing. */
export async function resolveLabels(
  userId: string,
  pairs: { type: string; id: string }[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (pairs.length === 0) return map;

  const byType = new Map<string, string[]>();
  for (const pair of pairs) {
    const bucket = byType.get(pair.type);
    if (bucket) bucket.push(pair.id);
    else byType.set(pair.type, [pair.id]);
  }

  for (const [type, ids] of byType) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) continue;
    let rows: { id: string; label: string }[] = [];

    if (type === "course") {
      rows = await db.select({ id: courses.id, label: courses.name }).from(courses).where(and(eq(courses.userId, userId), inArray(courses.id, unique)));
    } else if (type === "book") {
      rows = await db.select({ id: books.id, label: books.title }).from(books).where(and(eq(books.userId, userId), inArray(books.id, unique)));
    } else if (type === "project") {
      rows = await db.select({ id: projects.id, label: projects.name }).from(projects).where(and(eq(projects.userId, userId), inArray(projects.id, unique)));
    } else if (type === "note") {
      rows = await db.select({ id: notes.id, label: notes.title }).from(notes).where(and(eq(notes.userId, userId), inArray(notes.id, unique)));
    } else if (type === "concept") {
      rows = await db.select({ id: concepts.id, label: concepts.title }).from(concepts).where(and(eq(concepts.userId, userId), inArray(concepts.id, unique)));
    } else if (type === "question") {
      rows = await db.select({ id: questions.id, label: questions.question }).from(questions).where(and(eq(questions.userId, userId), inArray(questions.id, unique)));
    } else if (type === "skill") {
      rows = await db.select({ id: skills.id, label: skills.name }).from(skills).where(and(eq(skills.userId, userId), inArray(skills.id, unique)));
    } else if (type === "domain") {
      rows = await db.select({ id: polymathDomains.id, label: polymathDomains.name }).from(polymathDomains).where(and(eq(polymathDomains.userId, userId), inArray(polymathDomains.id, unique)));
    }

    for (const row of rows) map.set(`${type}:${row.id}`, row.label);
  }

  return map;
}

export async function listConnections(userId: string, limit = 200): Promise<ConnectionWithLabels[]> {
  const rows = await db
    .select()
    .from(knowledgeConnections)
    .where(eq(knowledgeConnections.userId, userId))
    .orderBy(desc(knowledgeConnections.createdAt))
    .limit(limit);

  const labels = await resolveLabels(
    userId,
    rows.flatMap((row) => [
      { type: row.fromType, id: row.fromId },
      { type: row.toType, id: row.toId },
    ]),
  );

  return rows.map((row) => ({
    ...row,
    fromLabel: labels.get(`${row.fromType}:${row.fromId}`) ?? "Unknown",
    toLabel: labels.get(`${row.toType}:${row.toId}`) ?? "Unknown",
  }));
}

/**
 * Creates a connection, rejecting self-links, cross-owner references and
 * duplicates (the unique index covers the same pair + relation).
 */
export async function createConnection(input: {
  userId: string;
  fromType: ConnectableType;
  fromId: string;
  toType: ConnectableType;
  toId: string;
  relation?: string;
  note?: string | null;
}): Promise<{ connection: KnowledgeConnection; created: boolean }> {
  if (input.fromType === input.toType && input.fromId === input.toId) {
    throw new Error("An item cannot connect to itself.");
  }

  const labels = await resolveLabels(input.userId, [
    { type: input.fromType, id: input.fromId },
    { type: input.toType, id: input.toId },
  ]);
  if (!labels.has(`${input.fromType}:${input.fromId}`)) throw new Error("That first item does not belong to you.");
  if (!labels.has(`${input.toType}:${input.toId}`)) throw new Error("That second item does not belong to you.");

  const relation = input.relation ?? "relates_to";
  const [existing] = await db
    .select()
    .from(knowledgeConnections)
    .where(
      and(
        eq(knowledgeConnections.userId, input.userId),
        eq(knowledgeConnections.fromType, input.fromType),
        eq(knowledgeConnections.fromId, input.fromId),
        eq(knowledgeConnections.toType, input.toType),
        eq(knowledgeConnections.toId, input.toId),
        eq(knowledgeConnections.relation, relation),
      ),
    )
    .limit(1);
  if (existing) return { connection: existing, created: false };

  const [row] = await db
    .insert(knowledgeConnections)
    .values({
      userId: input.userId,
      fromType: input.fromType,
      fromId: input.fromId,
      toType: input.toType,
      toId: input.toId,
      relation,
      note: input.note?.trim() || null,
    })
    .returning();
  return { connection: row!, created: true };
}

export async function deleteConnection(userId: string, connectionId: string): Promise<boolean> {
  const [row] = await db
    .delete(knowledgeConnections)
    .where(and(eq(knowledgeConnections.userId, userId), eq(knowledgeConnections.id, connectionId)))
    .returning({ id: knowledgeConnections.id });
  return Boolean(row);
}

/**
 * The neighbours of one item — what the knowledge graph panel shows when you
 * open a note, concept, skill or book.
 */
export async function connectionsFor(userId: string, type: ConnectableType, id: string) {
  const rows = await db
    .select()
    .from(knowledgeConnections)
    .where(
      and(
        eq(knowledgeConnections.userId, userId),
        or(
          and(eq(knowledgeConnections.fromType, type), eq(knowledgeConnections.fromId, id)),
          and(eq(knowledgeConnections.toType, type), eq(knowledgeConnections.toId, id)),
        )!,
      ),
    )
    .orderBy(desc(knowledgeConnections.createdAt));

  const labels = await resolveLabels(
    userId,
    rows.flatMap((row) => [
      { type: row.fromType, id: row.fromId },
      { type: row.toType, id: row.toId },
    ]),
  );

  return rows.map((row) => {
    const outgoing = row.fromType === type && row.fromId === id;
    const otherType = outgoing ? row.toType : row.fromType;
    const otherId = outgoing ? row.toId : row.fromId;
    return {
      id: row.id,
      relation: row.relation,
      note: row.note,
      direction: outgoing ? "out" : "in",
      otherType,
      otherId,
      otherLabel: labels.get(`${otherType}:${otherId}`) ?? "Unknown",
      selfLabel: labels.get(`${type}:${id}`) ?? "Unknown",
    };
  });
}

export async function learningStats(userId: string) {
  const [row] = await db
    .select({
      domains: sql<number>`(select count(*) from ${polymathDomains} where ${polymathDomains.userId} = ${userId} and ${polymathDomains.archivedAt} is null)`,
      concepts: sql<number>`(select count(*) from ${concepts} where ${concepts.userId} = ${userId})`,
      questions: sql<number>`(select count(*) from ${questions} where ${questions.userId} = ${userId} and ${questions.archivedAt} is null)`,
      openQuestions: sql<number>`(select count(*) from ${questions} where ${questions.userId} = ${userId} and ${questions.status} in ('open','researching') and ${questions.archivedAt} is null)`,
      notes: sql<number>`(select count(*) from ${notes} where ${notes.userId} = ${userId} and ${notes.archivedAt} is null)`,
      skills: sql<number>`(select count(*) from ${skills} where ${skills.userId} = ${userId} and ${skills.archivedAt} is null)`,
      evidence: sql<number>`(select count(*) from ${skillEvidence} where ${skillEvidence.userId} = ${userId})`,
      connections: sql<number>`(select count(*) from ${knowledgeConnections} where ${knowledgeConnections.userId} = ${userId})`,
    })
    .from(users)
    .where(eq(users.id, userId));

  const byStage = await db
    .select({ stage: sql<string>`${skills.stage}::text`, count: sql<number>`count(*)` })
    .from(skills)
    .where(and(eq(skills.userId, userId), isNull(skills.archivedAt)))
    .groupBy(skills.stage);

  const ordered = STAGE_ORDER.map((stage) => ({
    stage,
    count: Number(byStage.find((row2) => row2.stage === stage)?.count ?? 0),
  }));

  return {
    domains: Number(row?.domains ?? 0),
    concepts: Number(row?.concepts ?? 0),
    questions: Number(row?.questions ?? 0),
    openQuestions: Number(row?.openQuestions ?? 0),
    notes: Number(row?.notes ?? 0),
    skills: Number(row?.skills ?? 0),
    evidence: Number(row?.evidence ?? 0),
    connections: Number(row?.connections ?? 0),
    skillsByStage: ordered,
  };
}

export async function conceptOptions(userId: string) {
  return db
    .select({ id: concepts.id, title: concepts.title })
    .from(concepts)
    .where(eq(concepts.userId, userId))
    .orderBy(concepts.title)
    .limit(300);
}

/**
 * Every item the knowledge graph can connect, with a human label.
 *
 * Built from the real tables so the picker can never offer something that does
 * not exist — and never something belonging to another account.
 */
export async function linkOptions(userId: string): Promise<{ type: string; id: string; label: string }[]> {
  const [coursesRows, booksRows, projectsRows, notesRows, conceptsRows, questionsRows, skillsRows, domainsRows] =
    await Promise.all([
      db.select({ id: courses.id, label: courses.name }).from(courses).where(and(eq(courses.userId, userId), isNull(courses.archivedAt))).limit(200),
      db.select({ id: books.id, label: books.title }).from(books).where(and(eq(books.userId, userId), isNull(books.archivedAt))).limit(200),
      db.select({ id: projects.id, label: projects.name }).from(projects).where(and(eq(projects.userId, userId), isNull(projects.archivedAt))).limit(200),
      db.select({ id: notes.id, label: notes.title }).from(notes).where(and(eq(notes.userId, userId), isNull(notes.archivedAt))).limit(300),
      db.select({ id: concepts.id, label: concepts.title }).from(concepts).where(eq(concepts.userId, userId)).limit(300),
      db.select({ id: questions.id, label: questions.question }).from(questions).where(and(eq(questions.userId, userId), isNull(questions.archivedAt))).limit(300),
      db.select({ id: skills.id, label: skills.name }).from(skills).where(and(eq(skills.userId, userId), isNull(skills.archivedAt))).limit(300),
      db.select({ id: polymathDomains.id, label: polymathDomains.name }).from(polymathDomains).where(and(eq(polymathDomains.userId, userId), isNull(polymathDomains.archivedAt))).limit(300),
    ]);

  const tag = (type: string, rows: { id: string; label: string }[]) =>
    rows.map((row) => ({ type, id: row.id, label: row.label }));

  return [
    ...tag("note", notesRows),
    ...tag("concept", conceptsRows),
    ...tag("question", questionsRows),
    ...tag("skill", skillsRows),
    ...tag("domain", domainsRows),
    ...tag("book", booksRows),
    ...tag("course", coursesRows),
    ...tag("project", projectsRows),
  ];
}
