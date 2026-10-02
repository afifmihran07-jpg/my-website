import "server-only";
import { z } from "zod";

import { dateKey, iso, masteryStage, optionalInt, optionalText, optionalUrl, requiredText, tagList, uuid } from "@/server/services/common-validation";
import type {
  ConceptWithLinks,
  ConnectionWithLabels,
  DomainWithCounts,
  NoteWithLinks,
  QuestionWithLinks,
  SkillWithEvidence,
} from "@/server/services/learning";

/* ------------------------------- domains ---------------------------------- */

export const domainCategory = z.enum(["stem", "business", "human_sciences", "creation", "life_nature", "other"]);

export const createDomainSchema = z.object({
  name: requiredText(120, "Domain name"),
  category: domainCategory.default("other"),
  stage: masteryStage,
  summary: optionalText(2000, "Summary"),
  parentId: uuid,
  sortOrder: optionalInt(-10_000, 10_000, "Sort order"),
});

export const updateDomainSchema = createDomainSchema.partial().extend({ archived: z.boolean().optional() });

export function serializeDomain(domain: DomainWithCounts): SerializedDomain {
  return {
    id: domain.id,
    name: domain.name,
    category: domain.category,
    stage: domain.stage,
    summary: domain.summary,
    parentId: domain.parentId,
    sortOrder: domain.sortOrder,
    bookCount: domain.bookCount,
    conceptCount: domain.conceptCount,
    questionCount: domain.questionCount,
    skillCount: domain.skillCount,
    noteCount: domain.noteCount,
    studySeconds: domain.studySeconds,
    readingSeconds: domain.readingSeconds,
    children: domain.children.map(serializeDomain),
  };
}

export type SerializedDomain = {
  id: string;
  name: string;
  category: string;
  stage: string;
  summary: string | null;
  parentId: string | null;
  sortOrder: number;
  bookCount: number;
  conceptCount: number;
  questionCount: number;
  skillCount: number;
  noteCount: number;
  studySeconds: number;
  readingSeconds: number;
  children: SerializedDomain[];
};

export const DOMAIN_CATEGORY_LABELS: Record<z.infer<typeof domainCategory>, string> = {
  stem: "STEM",
  business: "Business",
  human_sciences: "Human sciences",
  creation: "Creation & design",
  life_nature: "Life & nature",
  other: "Other",
};

/* ------------------------------- concepts --------------------------------- */

export const conceptStatus = z.enum(["new", "learning", "understood", "applied"]);

export const createConceptSchema = z.object({
  title: requiredText(200, "Concept"),
  summary: optionalText(4000, "Summary"),
  domainId: uuid,
  courseId: uuid,
  bookId: uuid,
  status: conceptStatus.default("new"),
});

export const updateConceptSchema = createConceptSchema.partial();

export function serializeConcept(concept: ConceptWithLinks) {
  return {
    id: concept.id,
    title: concept.title,
    summary: concept.summary,
    status: concept.status,
    domainId: concept.domainId,
    domainName: concept.domainName,
    courseId: concept.courseId,
    courseName: concept.courseName,
    bookId: concept.bookId,
    bookTitle: concept.bookTitle,
    noteCount: concept.noteCount,
    questionCount: concept.questionCount,
    updatedAt: iso(concept.updatedAt),
  };
}

export type SerializedConcept = ReturnType<typeof serializeConcept>;

export const CONCEPT_STATUS_LABELS: Record<z.infer<typeof conceptStatus>, string> = {
  new: "New",
  learning: "Learning",
  understood: "Understood",
  applied: "Applied",
};

/* ------------------------------- questions -------------------------------- */

export const questionStatus = z.enum(["open", "researching", "answered", "dropped"]);

export const createQuestionSchema = z.object({
  question: requiredText(1000, "Question"),
  context: optionalText(4000, "Context"),
  courseId: uuid,
  bookId: uuid,
  conceptId: uuid,
  domainId: uuid,
});

export const updateQuestionSchema = createQuestionSchema.partial().extend({
  answer: optionalText(8000, "Answer"),
  status: questionStatus,
  archived: z.boolean().optional(),
});

export function serializeQuestion(question: QuestionWithLinks) {
  return {
    id: question.id,
    question: question.question,
    context: question.context,
    answer: question.answer,
    status: question.status,
    courseId: question.courseId,
    courseName: question.courseName,
    bookId: question.bookId,
    bookTitle: question.bookTitle,
    conceptId: question.conceptId,
    conceptTitle: question.conceptTitle,
    domainId: question.domainId,
    domainName: question.domainName,
    answeredAt: iso(question.answeredAt),
    openDays: question.openDays,
    createdAt: iso(question.createdAt),
  };
}

export type SerializedQuestion = ReturnType<typeof serializeQuestion>;

export const QUESTION_STATUS_LABELS: Record<z.infer<typeof questionStatus>, string> = {
  open: "Open",
  researching: "Researching",
  answered: "Answered",
  dropped: "Dropped",
};

export const QUESTION_STATUS_TONES: Record<z.infer<typeof questionStatus>, "neutral" | "primary" | "accent" | "warning" | "danger"> = {
  open: "warning",
  researching: "accent",
  answered: "primary",
  dropped: "neutral",
};

/* --------------------------------- notes ---------------------------------- */

export const createNoteSchema = z.object({
  title: requiredText(200, "Title"),
  body: optionalText(40_000, "Note"),
  tags: tagList,
  pinned: z.boolean().optional(),
  courseId: uuid,
  bookId: uuid,
  conceptId: uuid,
  projectId: uuid,
  domainId: uuid,
});

export const updateNoteSchema = createNoteSchema.partial().extend({ archived: z.boolean().optional() });

export function serializeNote(note: NoteWithLinks) {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    tags: note.tags,
    pinned: note.pinned,
    courseId: note.courseId,
    courseName: note.courseName,
    bookId: note.bookId,
    bookTitle: note.bookTitle,
    conceptId: note.conceptId,
    conceptTitle: note.conceptTitle,
    projectId: note.projectId,
    projectName: note.projectName,
    domainId: note.domainId,
    domainName: note.domainName,
    connectionCount: note.connectionCount,
    updatedAt: iso(note.updatedAt),
  };
}

export type SerializedNote = ReturnType<typeof serializeNote>;

/* --------------------------------- skills --------------------------------- */

export const evidenceKind = z.enum([
  "course",
  "book",
  "project",
  "competition",
  "achievement",
  "certificate",
  "problem_set",
  "repository",
  "presentation",
  "other",
]);

export const createSkillSchema = z.object({
  name: requiredText(120, "Skill name"),
  category: optionalText(80, "Category"),
  description: optionalText(2000, "Description"),
  stage: masteryStage,
  domainId: uuid,
});

export const updateSkillSchema = createSkillSchema.partial().extend({ archived: z.boolean().optional() });

export const addEvidenceSchema = z.object({
  skillId: z.uuid("Choose a skill"),
  kind: evidenceKind.default("other"),
  title: requiredText(200, "Evidence title"),
  metricLabel: optionalText(60, "Metric label"),
  metricValue: optionalInt(-1_000_000, 1_000_000, "Metric value"),
  url: optionalUrl,
  occurredAt: dateKey,
});

export function serializeSkill(skill: SkillWithEvidence) {
  return {
    id: skill.id,
    name: skill.name,
    category: skill.category,
    description: skill.description,
    stage: skill.stage,
    suggestedStage: skill.suggestedStage,
    domainId: skill.domainId,
    domainName: skill.domainName,
    evidenceCount: skill.evidenceCount,
    latestEvidenceAt: skill.latestEvidenceAt,
    evidence: skill.evidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      metricLabel: item.metricLabel,
      metricValue: item.metricValue,
      url: item.url,
      occurredAt: item.occurredAt,
    })),
  };
}

export type SerializedSkill = ReturnType<typeof serializeSkill>;

export const EVIDENCE_KIND_LABELS: Record<z.infer<typeof evidenceKind>, string> = {
  course: "Course",
  book: "Book",
  project: "Project",
  competition: "Competition",
  achievement: "Achievement",
  certificate: "Certificate",
  problem_set: "Problem set",
  repository: "Repository",
  presentation: "Presentation",
  other: "Other",
};

/* ------------------------------ connections -------------------------------- */

export const connectableType = z.enum([
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
]);

export const relationType = z.enum([
  "relates_to",
  "depends_on",
  "supports",
  "contradicts",
  "example_of",
  "led_to",
  "part_of",
]);

export const createConnectionSchema = z
  .object({
    fromType: connectableType,
    fromId: z.uuid("Pick a valid item"),
    toType: connectableType,
    toId: z.uuid("Pick a valid item"),
    relation: relationType.default("relates_to"),
    note: optionalText(1000, "Note"),
  })
  .refine((value) => !(value.fromType === value.toType && value.fromId === value.toId), {
    message: "An item cannot connect to itself",
  });

export function serializeConnection(connection: ConnectionWithLabels) {
  return {
    id: connection.id,
    fromType: connection.fromType,
    fromId: connection.fromId,
    fromLabel: connection.fromLabel,
    toType: connection.toType,
    toId: connection.toId,
    toLabel: connection.toLabel,
    relation: connection.relation,
    note: connection.note,
    createdAt: iso(connection.createdAt),
  };
}

export type SerializedConnection = ReturnType<typeof serializeConnection>;

export const RELATION_LABELS: Record<z.infer<typeof relationType>, string> = {
  relates_to: "relates to",
  depends_on: "depends on",
  supports: "supports",
  contradicts: "contradicts",
  example_of: "is an example of",
  led_to: "led to",
  part_of: "is part of",
};

export const CONNECTABLE_TYPE_LABELS: Record<z.infer<typeof connectableType>, string> = {
  course: "Course",
  book: "Book",
  project: "Project",
  goal: "Goal",
  note: "Note",
  concept: "Concept",
  question: "Question",
  skill: "Skill",
  domain: "Domain",
  opportunity: "Opportunity",
  achievement: "Achievement",
};
