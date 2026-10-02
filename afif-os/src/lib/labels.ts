/**
 * Shared UI label maps.
 *
 * This module is deliberately plain: no `server-only`, no database, no Zod.
 * Client components need these strings to render, and a module marked
 * `server-only` cannot be imported into the client bundle — the build fails.
 * The Zod enums in the `*-validation.ts` files are built from the arrays here,
 * so the accepted values and the labels can never drift apart.
 */

export type Tone = "neutral" | "primary" | "accent" | "warning" | "danger";

/* --------------------------------- prayer ---------------------------------- */

export const PRAYER_NAMES = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const PRAYER_STATUS_NAMES = ["on_time", "late", "missed", "qada"] as const;
export type PrayerStatus = (typeof PRAYER_STATUS_NAMES)[number];

export const PRAYER_STATUS_LABELS: Record<PrayerStatus, string> = {
  on_time: "On time",
  late: "Late",
  missed: "Missed",
  qada: "Qada",
};

export const PRAYER_STATUS_TONES: Record<PrayerStatus, Tone> = {
  on_time: "primary",
  late: "warning",
  missed: "danger",
  qada: "neutral",
};

/* ---------------------------------- diary ---------------------------------- */

export const MOOD_LABELS: Record<number, string> = {
  1: "Very low",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

/* ----------------------------- monthly reflection -------------------------- */

export const REFLECTION_FIELD_LABELS: Record<string, string> = {
  learned: "What did I learn?",
  accomplished: "What did I accomplish?",
  struggled: "What did I struggle with?",
  thinkingChanged: "How did my thinking change?",
  proudOf: "What am I proud of?",
  stopDoing: "What should I stop doing?",
  focusNext: "What will I focus on next?",
};

/* ---------------------------------- books ---------------------------------- */

export const BOOK_STATUS_NAMES = ["want_to_read", "reading", "paused", "completed"] as const;
export type BookStatus = (typeof BOOK_STATUS_NAMES)[number];

export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  want_to_read: "Want to read",
  reading: "Reading",
  paused: "Paused",
  completed: "Finished",
};

export const BOOK_STATUS_TONES: Record<BookStatus, Tone> = {
  want_to_read: "neutral",
  reading: "accent",
  paused: "warning",
  completed: "primary",
};

/* ---------------- shared status / category / relation maps ---------------- */

export const PROJECT_STATUS_NAMES = ["planning", "active", "paused", "completed", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUS_NAMES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

export const PROJECT_STATUS_TONES: Record<ProjectStatus, Tone> = {
  planning: "neutral",
  active: "accent",
  paused: "warning",
  completed: "primary",
  archived: "neutral",
};

export const ACHIEVEMENT_CATEGORY_NAMES = ["academic_award", "scholarship", "certificate", "competition", "hackathon", "research", "conference", "project", "leadership", "presentation", "publication", "milestone", "other"] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORY_NAMES)[number];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  academic_award: "Academic award",
  scholarship: "Scholarship",
  certificate: "Certificate",
  competition: "Competition",
  hackathon: "Hackathon",
  research: "Research",
  conference: "Conference",
  project: "Project",
  leadership: "Leadership",
  presentation: "Presentation",
  publication: "Publication",
  milestone: "Milestone",
  other: "Other",
};

export const OPPORTUNITY_TYPE_NAMES = ["competition", "hackathon", "scholarship", "internship", "research", "conference", "workshop", "certification"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPE_NAMES)[number];

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  competition: "Competitions",
  hackathon: "Hackathons",
  scholarship: "Scholarships",
  internship: "Internships",
  research: "Research",
  conference: "Conferences",
  workshop: "Workshops",
  certification: "Certifications",
};

export const OPPORTUNITY_STATUS_NAMES = ["interested", "applied", "accepted", "rejected", "completed", "not_interested", "archived"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUS_NAMES)[number];

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  accepted: "Accepted",
  rejected: "Rejected",
  completed: "Completed",
  not_interested: "Not interested",
  archived: "Archived",
};

export const OPPORTUNITY_STATUS_TONES: Record<OpportunityStatus, Tone> = {
  interested: "neutral",
  applied: "accent",
  accepted: "primary",
  rejected: "danger",
  completed: "primary",
  not_interested: "neutral",
  archived: "neutral",
};

export const DOMAIN_CATEGORY_NAMES = ["stem", "business", "human_sciences", "creation", "life_nature", "other"] as const;
export type DomainCategory = (typeof DOMAIN_CATEGORY_NAMES)[number];

export const DOMAIN_CATEGORY_LABELS: Record<DomainCategory, string> = {
  stem: "STEM",
  business: "Business",
  human_sciences: "Human sciences",
  creation: "Creation & design",
  life_nature: "Life & nature",
  other: "Other",
};

export const CONCEPT_STATUS_NAMES = ["new", "learning", "understood", "applied"] as const;
export type ConceptStatus = (typeof CONCEPT_STATUS_NAMES)[number];

export const CONCEPT_STATUS_LABELS: Record<ConceptStatus, string> = {
  new: "New",
  learning: "Learning",
  understood: "Understood",
  applied: "Applied",
};

export const QUESTION_STATUS_NAMES = ["open", "researching", "answered", "dropped"] as const;
export type QuestionStatus = (typeof QUESTION_STATUS_NAMES)[number];

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  open: "Open",
  researching: "Researching",
  answered: "Answered",
  dropped: "Dropped",
};

export const QUESTION_STATUS_TONES: Record<QuestionStatus, Tone> = {
  open: "warning",
  researching: "accent",
  answered: "primary",
  dropped: "neutral",
};

export const EVIDENCE_KIND_NAMES = ["course", "book", "project", "competition", "achievement", "certificate", "problem_set", "repository", "presentation", "other"] as const;
export type EvidenceKind = (typeof EVIDENCE_KIND_NAMES)[number];

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
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

export const CONNECTABLE_TYPE_NAMES = ["course", "book", "project", "goal", "note", "concept", "question", "skill", "domain", "opportunity", "achievement"] as const;
export type ConnectableType = (typeof CONNECTABLE_TYPE_NAMES)[number];

export const CONNECTABLE_TYPE_LABELS: Record<ConnectableType, string> = {
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

export const RELATION_TYPE_NAMES = ["relates_to", "depends_on", "supports", "contradicts", "example_of", "led_to", "part_of"] as const;
export type RelationType = (typeof RELATION_TYPE_NAMES)[number];

export const RELATION_LABELS: Record<RelationType, string> = {
  relates_to: "relates to",
  depends_on: "depends on",
  supports: "supports",
  contradicts: "contradicts",
  example_of: "is an example of",
  led_to: "led to",
  part_of: "is part of",
};
