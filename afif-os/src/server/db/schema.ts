/**
 * Afif OS — PostgreSQL schema
 *
 * Design rules applied throughout:
 *  - every row is owned by exactly one user (`userId`) — this is a single-user
 *    system, but ownership is enforced in the schema and in every query so
 *    nothing can ever leak across accounts.
 *  - secure random UUID primary keys.
 *  - `createdAt` / `updatedAt` on every table.
 *  - soft delete (`archivedAt`) wherever history matters (§37).
 *  - explicit foreign keys with deliberate cascade behaviour.
 *  - indexes on every column used for filtering or joining.
 */

import { randomUUID } from "node:crypto";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const id = (name = "id") => uuid(name).primaryKey().$defaultFn(() => randomUUID());

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

const userId = () =>
  uuid("user_id")
    .notNull()
    .references((): AnyPgColumn => users.id, { onDelete: "cascade" });

/* ------------------------------------------------------------------ */
/* enums                                                               */
/* ------------------------------------------------------------------ */

export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "completed", "cancelled"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const taskBucketEnum = pgEnum("task_bucket", ["today", "upcoming", "someday"]);
export const recurrenceEnum = pgEnum("recurrence", ["none", "daily", "weekly", "monthly", "custom"]);

export const semesterStatusEnum = pgEnum("semester_status", ["planned", "active", "completed", "archived"]);
export const courseStatusEnum = pgEnum("course_status", ["active", "completed", "dropped", "archived"]);
export const assessmentKindEnum = pgEnum("assessment_kind", [
  "quiz",
  "assignment",
  "midterm",
  "final",
  "presentation",
  "lab",
  "other",
]);
export const resourceKindEnum = pgEnum("resource_kind", [
  "drive",
  "pdf",
  "youtube",
  "link",
  "github",
  "assignment",
  "note",
  "other",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
]);
export const goalStatusEnum = pgEnum("goal_status", ["active", "achieved", "paused", "abandoned"]);

export const eventKindEnum = pgEnum("event_kind", [
  "class",
  "study",
  "task",
  "deadline",
  "exam",
  "competition",
  "milestone",
  "book",
  "activity",
  "medication",
  "prayer",
  "personal",
  "reminder",
]);

export const studyStatusEnum = pgEnum("study_status", [
  "active",
  "paused",
  "completed",
  "discarded",
]);

export const reminderStatusEnum = pgEnum("reminder_status", [
  "scheduled",
  "queued",
  "sent",
  "delivered",
  "completed",
  "missed",
  "failed",
  "cancelled",
]);
export const reminderLogEventEnum = pgEnum("reminder_log_event", [
  "created",
  "queued",
  "sent",
  "delivered",
  "opened",
  "completed",
  "failed",
  "missed",
  "rescheduled",
  "cancelled",
]);
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "web_push", "email", "none"]);

export const bookStatusEnum = pgEnum("book_status", ["want_to_read", "reading", "paused", "completed"]);
export const conceptStatusEnum = pgEnum("concept_status", ["new", "learning", "understood", "applied"]);
export const questionStatusEnum = pgEnum("question_status", ["open", "researching", "answered", "dropped"]);

export const masteryStageEnum = pgEnum("mastery_stage", [
  "exposure",
  "foundation",
  "working_knowledge",
  "applied",
  "advanced",
]);
export const domainCategoryEnum = pgEnum("domain_category", [
  "stem",
  "business",
  "human_sciences",
  "creation",
  "life_nature",
  "other",
]);

export const skillEvidenceKindEnum = pgEnum("skill_evidence_kind", [
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

export const opportunityTypeEnum = pgEnum("opportunity_type", [
  "competition",
  "hackathon",
  "scholarship",
  "internship",
  "research",
  "conference",
  "workshop",
  "certification",
]);
export const opportunityStatusEnum = pgEnum("opportunity_status", [
  "interested",
  "applied",
  "accepted",
  "rejected",
  "completed",
  "not_interested",
  "archived",
]);

export const achievementCategoryEnum = pgEnum("achievement_category", [
  "academic_award",
  "scholarship",
  "certificate",
  "competition",
  "hackathon",
  "research",
  "conference",
  "project",
  "leadership",
  "presentation",
  "publication",
  "milestone",
  "other",
]);

export const prayerEnum = pgEnum("prayer_name", ["fajr", "dhuhr", "asr", "maghrib", "isha"]);
export const prayerStatusEnum = pgEnum("prayer_status", ["on_time", "late", "missed", "qada"]);

export const medicationLogStatusEnum = pgEnum("medication_log_status", [
  "pending",
  "taken",
  "skipped",
  "missed",
]);

export const linkTypeEnum = pgEnum("link_type", [
  "course",
  "book",
  "project",
  "goal",
  "task",
  "note",
  "concept",
  "question",
  "skill",
  "domain",
  "opportunity",
  "achievement",
  "study_session",
  "event",
  "diary",
  "photo",
  "activity",
  "none",
]);

/* ------------------------------------------------------------------ */
/* identity                                                            */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    /** bcrypt hash. Never serialised by any API route or server action. */
    passwordHash: text("password_hash").notNull(),
    avatarUrl: text("avatar_url"),
    timezone: text("timezone").notNull().default("Asia/Dhaka"),
    theme: text("theme", { enum: ["light", "dark", "system"] }).notNull().default("system"),
    weekStartsOn: integer("week_starts_on").notNull().default(6), // 0=Sun … 6=Sat
    /** Persisted lockout state so rate limiting survives restarts (§3, §41). */
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    notificationPermission: text("notification_permission", {
      enum: ["default", "granted", "denied", "unsupported", "unknown"],
    })
      .notNull()
      .default("unknown"),
    pushSubscription: jsonb("push_subscription"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_username_unique").on(sql`lower(${t.username})`),
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: userId(),
    /** SHA-256 of the opaque cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    remember: boolean("remember").notNull().default(false),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("sessions_token_hash_unique").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    ipAddress: text("ip_address"),
    succeeded: boolean("succeeded").notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_identifier_idx").on(t.identifier, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* academic                                                            */
/* ------------------------------------------------------------------ */

export const gradingRules = pgTable("grading_rules", {
  id: id(),
  userId: userId(),
  name: text("name").notNull(),
  /** e.g. 4.00 scale */
  scaleMax: numeric("scale_max", { precision: 4, scale: 2 }).notNull().default("4.00"),
  /** ordered list of { minPercent, gradePoint, letter } — configurable, never hardcoded (§17) */
  bands: jsonb("bands")
    .notNull()
    .$type<Array<{ minPercent: number; gradePoint: number; letter: string }>>()
    .default([
      { minPercent: 90, gradePoint: 4.0, letter: "A" },
      { minPercent: 85, gradePoint: 3.7, letter: "A-" },
      { minPercent: 80, gradePoint: 3.3, letter: "B+" },
      { minPercent: 75, gradePoint: 3.0, letter: "B" },
      { minPercent: 70, gradePoint: 2.7, letter: "B-" },
      { minPercent: 65, gradePoint: 2.3, letter: "C+" },
      { minPercent: 60, gradePoint: 2.0, letter: "C" },
      { minPercent: 55, gradePoint: 1.7, letter: "C-" },
      { minPercent: 50, gradePoint: 1.3, letter: "D+" },
      { minPercent: 45, gradePoint: 1.0, letter: "D" },
      { minPercent: 0, gradePoint: 0.0, letter: "F" },
    ]),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const semesters = pgTable(
  "semesters",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: semesterStatusEnum("status").notNull().default("planned"),
    targetCgpa: numeric("target_cgpa", { precision: 4, scale: 2 }),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("semesters_user_status_idx").on(t.userId, t.status)],
);

export const courses = pgTable(
  "courses",
  {
    id: id(),
    userId: userId(),
    semesterId: uuid("semester_id")
      .notNull()
      .references((): AnyPgColumn => semesters.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    credits: numeric("credits", { precision: 4, scale: 2 }).notNull().default("3"),
    faculty: text("faculty"),
    section: text("section"),
    status: courseStatusEnum("status").notNull().default("active"),
    color: text("color").notNull().default("#6366f1"),
    /**
     * Final outcome, used for completed courses where only the awarded grade is
     * known. Nullable on purpose — in-progress courses are computed from
     * assessments instead of guessed.
     */
    awardedGradePoint: numeric("awarded_grade_point", { precision: 4, scale: 2 }),
    awardedLetter: text("awarded_letter"),
    targetGrade: text("target_grade"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("courses_user_semester_idx").on(t.userId, t.semesterId),
    index("courses_user_status_idx").on(t.userId, t.status),
    uniqueIndex("courses_user_semester_code_unique").on(t.userId, t.semesterId, sql`lower(${t.code})`),
  ],
);

/** Weekly recurring university class slots — distinct from self-study (§8). */
export const classSchedules = pgTable(
  "class_schedules",
  {
    id: id(),
    userId: userId(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => courses.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday … 6=Saturday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    room: text("room"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("class_schedules_user_day_idx").on(t.userId, t.dayOfWeek)],
);

export const courseResources = pgTable(
  "course_resources",
  {
    id: id(),
    userId: userId(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    kind: resourceKindEnum("kind").notNull().default("link"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("course_resources_course_idx").on(t.courseId)],
);

export const assessments = pgTable(
  "assessments",
  {
    id: id(),
    userId: userId(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => courses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: assessmentKindEnum("kind").notNull().default("other"),
    maxMarks: numeric("max_marks", { precision: 8, scale: 2 }).notNull(),
    /** percentage of the final grade, e.g. 25 for 25% */
    weight: numeric("weight", { precision: 5, scale: 2 }).notNull().default("0"),
    scheduledFor: date("scheduled_for"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("assessments_course_idx").on(t.courseId)],
);

export const grades = pgTable(
  "grades",
  {
    id: id(),
    userId: userId(),
    courseId: uuid("course_id")
      .notNull()
      .references((): AnyPgColumn => courses.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references((): AnyPgColumn => assessments.id, { onDelete: "cascade" }),
    obtainedMarks: numeric("obtained_marks", { precision: 8, scale: 2 }).notNull(),
    gradedAt: timestamp("graded_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("grades_assessment_unique").on(t.assessmentId),
    index("grades_course_idx").on(t.courseId),
  ],
);

/* ------------------------------------------------------------------ */
/* goals → projects → tasks                                            */
/* ------------------------------------------------------------------ */

export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    description: text("description"),
    domainId: uuid("domain_id"),
    targetDate: date("target_date"),
    status: goalStatusEnum("status").notNull().default("active"),
    achievedAt: timestamp("achieved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("goals_user_status_idx").on(t.userId, t.status)],
);

export const projects = pgTable(
  "projects",
  {
    id: id(),
    userId: userId(),
    goalId: uuid("goal_id").references((): AnyPgColumn => goals.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("planning"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    url: text("url"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("projects_user_status_idx").on(t.userId, t.status)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    status: taskStatusEnum("status").notNull().default("todo"),
    bucket: taskBucketEnum("bucket").notNull().default("upcoming"),
    dueDate: date("due_date"),
    dueTime: time("due_time"),
    estimatedMinutes: integer("estimated_minutes"),
    category: text("category"),
    recurrence: recurrenceEnum("recurrence").notNull().default("none"),
    recurrenceRule: text("recurrence_rule"),
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references((): AnyPgColumn => projects.id, { onDelete: "set null" }),
    goalId: uuid("goal_id").references((): AnyPgColumn => goals.id, { onDelete: "set null" }),
    opportunityId: uuid("opportunity_id"),
    parentId: uuid("parent_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("tasks_user_status_idx").on(t.userId, t.status),
    index("tasks_user_due_idx").on(t.userId, t.dueDate),
    index("tasks_course_idx").on(t.courseId),
    index("tasks_project_idx").on(t.projectId),
  ],
);

/* ------------------------------------------------------------------ */
/* calendar + study                                                    */
/* ------------------------------------------------------------------ */

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    kind: eventKindEnum("kind").notNull().default("personal"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    location: text("location"),
    notes: text("notes"),
    recurrence: recurrenceEnum("recurrence").notNull().default("none"),
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references((): AnyPgColumn => projects.id, { onDelete: "set null" }),
    bookId: uuid("book_id"),
    opportunityId: uuid("opportunity_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("calendar_events_user_start_idx").on(t.userId, t.startsAt), index("calendar_events_kind_idx").on(t.userId, t.kind)],
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    /** self-study only; university class time is never written here (§8) */
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    topic: text("topic"),
    bookId: uuid("book_id"),
    projectId: uuid("project_id").references((): AnyPgColumn => projects.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    /** start of the currently-running interval; null while paused */
    runningSince: timestamp("running_since", { withTimezone: true }),
    /** seconds already banked before the current running interval */
    accumulatedSeconds: integer("accumulated_seconds").notNull().default(0),
    /** server-computed, never trusted from the browser (§34) */
    durationSeconds: integer("duration_seconds").notNull().default(0),
    plannedMinutes: integer("planned_minutes"),
    status: studyStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    /** idempotency key so a double-clicked "Stop & Save" cannot double-insert */
    clientKey: text("client_key"),
    /** last time the client proved the tab was still alive */
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("study_sessions_user_started_idx").on(t.userId, t.startedAt),
    index("study_sessions_user_status_idx").on(t.userId, t.status),
    uniqueIndex("study_sessions_client_key_unique").on(t.userId, t.clientKey),
  ],
);

/* ------------------------------------------------------------------ */
/* reminder engine                                                     */
/* ------------------------------------------------------------------ */

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    description: text("description"),
    /** absolute instant to fire, stored in UTC */
    remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull().default("Asia/Dhaka"),
    recurrence: recurrenceEnum("recurrence").notNull().default("none"),
    recurrenceRule: text("recurrence_rule"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    linkedType: linkTypeEnum("linked_type").notNull().default("none"),
    linkedId: text("linked_id"),
    status: reminderStatusEnum("status").notNull().default("scheduled"),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastError: text("last_error"),
    /** prevents a recurring reminder from being enqueued twice for one slot */
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("reminders_dedupe_unique").on(t.dedupeKey),
    index("reminders_due_idx").on(t.status, t.remindAt),
    index("reminders_user_idx").on(t.userId, t.status),
  ],
);

export const reminderLogs = pgTable(
  "reminder_logs",
  {
    id: id(),
    reminderId: uuid("reminder_id")
      .notNull()
      .references((): AnyPgColumn => reminders.id, { onDelete: "cascade" }),
    userId: userId(),
    event: reminderLogEventEnum("event").notNull(),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("reminder_logs_reminder_idx").on(t.reminderId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    body: text("body"),
    kind: text("kind").notNull().default("info"),
    actionUrl: text("action_url"),
    reminderId: uuid("reminder_id").references((): AnyPgColumn => reminders.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_unread_idx").on(t.userId, t.readAt)],
);

/* ------------------------------------------------------------------ */
/* learning                                                            */
/* ------------------------------------------------------------------ */

export const polymathDomains = pgTable(
  "polymath_domains",
  {
    id: id(),
    userId: userId(),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    category: domainCategoryEnum("category").notNull().default("other"),
    /** stages, never fake percentages (§21) */
    stage: masteryStageEnum("stage").notNull().default("exposure"),
    summary: text("summary"),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("polymath_domains_user_parent_idx").on(t.userId, t.parentId)],
);

export const books = pgTable(
  "books",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    author: text("author"),
    totalPages: integer("total_pages"),
    currentPage: integer("current_page").notNull().default(0),
    status: bookStatusEnum("status").notNull().default("want_to_read"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    targetFinishDate: date("target_finish_date"),
    dailyPageTarget: integer("daily_page_target"),
    rating: integer("rating"),
    review: text("review"),
    domainId: uuid("domain_id"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("books_user_status_idx").on(t.userId, t.status)],
);

export const readingSessions = pgTable(
  "reading_sessions",
  {
    id: id(),
    userId: userId(),
    bookId: uuid("book_id")
      .notNull()
      .references((): AnyPgColumn => books.id, { onDelete: "cascade" }),
    pagesFrom: integer("pages_from").notNull().default(0),
    pagesTo: integer("pages_to").notNull().default(0),
    pagesRead: integer("pages_read").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reading_sessions_user_idx").on(t.userId, t.startedAt)],
);

export const concepts = pgTable(
  "concepts",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    summary: text("summary"),
    domainId: uuid("domain_id").references((): AnyPgColumn => polymathDomains.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    bookId: uuid("book_id").references((): AnyPgColumn => books.id, { onDelete: "set null" }),
    status: conceptStatusEnum("status").notNull().default("new"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("concepts_user_idx").on(t.userId)],
);

export const questions = pgTable(
  "questions",
  {
    id: id(),
    userId: userId(),
    question: text("question").notNull(),
    context: text("context"),
    answer: text("answer"),
    status: questionStatusEnum("status").notNull().default("open"),
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    bookId: uuid("book_id").references((): AnyPgColumn => books.id, { onDelete: "set null" }),
    conceptId: uuid("concept_id").references((): AnyPgColumn => concepts.id, { onDelete: "set null" }),
    domainId: uuid("domain_id").references((): AnyPgColumn => polymathDomains.id, { onDelete: "set null" }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("questions_user_status_idx").on(t.userId, t.status)],
);

export const notes = pgTable(
  "notes",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    body: text("body"),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    pinned: boolean("pinned").notNull().default(false),
    sourceType: linkTypeEnum("source_type").notNull().default("none"),
    sourceId: text("source_id"),
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    bookId: uuid("book_id").references((): AnyPgColumn => books.id, { onDelete: "set null" }),
    conceptId: uuid("concept_id").references((): AnyPgColumn => concepts.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references((): AnyPgColumn => projects.id, { onDelete: "set null" }),
    domainId: uuid("domain_id").references((): AnyPgColumn => polymathDomains.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("notes_user_idx").on(t.userId), index("notes_user_updated_idx").on(t.userId, t.updatedAt)],
);

export const skills = pgTable(
  "skills",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    /** stage + evidence, never a bare percentage (§23) */
    stage: masteryStageEnum("stage").notNull().default("exposure"),
    domainId: uuid("domain_id").references((): AnyPgColumn => polymathDomains.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("skills_user_idx").on(t.userId)],
);

export const skillEvidence = pgTable(
  "skill_evidence",
  {
    id: id(),
    userId: userId(),
    skillId: uuid("skill_id")
      .notNull()
      .references((): AnyPgColumn => skills.id, { onDelete: "cascade" }),
    kind: skillEvidenceKindEnum("kind").notNull().default("other"),
    title: text("title").notNull(),
    metricLabel: text("metric_label"),
    metricValue: integer("metric_value"),
    url: text("url"),
    linkedType: linkTypeEnum("linked_type").notNull().default("none"),
    linkedId: text("linked_id"),
    occurredAt: date("occurred_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("skill_evidence_skill_idx").on(t.skillId)],
);

export const knowledgeConnections = pgTable(
  "knowledge_connections",
  {
    id: id(),
    userId: userId(),
    fromType: linkTypeEnum("from_type").notNull(),
    fromId: text("from_id").notNull(),
    toType: linkTypeEnum("to_type").notNull(),
    toId: text("to_id").notNull(),
    relation: text("relation").notNull().default("relates_to"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("knowledge_connections_unique").on(t.fromType, t.fromId, t.toType, t.toId, t.relation),
    index("knowledge_connections_user_idx").on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* opportunities + achievements                                        */
/* ------------------------------------------------------------------ */

export const opportunities = pgTable(
  "opportunities",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    type: opportunityTypeEnum("type").notNull().default("competition"),
    source: text("source"),
    deadline: date("deadline"),
    registrationUrl: text("registration_url"),
    description: text("description"),
    whyInterested: text("why_interested"),
    status: opportunityStatusEnum("status").notNull().default("interested"),
    reminderEnabled: boolean("reminder_enabled").notNull().default(false),
    skills: text("skills").array().notNull().default(sql`'{}'`),
    domains: text("domains").array().notNull().default(sql`'{}'`),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("opportunities_user_status_idx").on(t.userId, t.status), index("opportunities_deadline_idx").on(t.deadline)],
);

export const achievements = pgTable(
  "achievements",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    description: text("description"),
    occurredOn: date("occurred_on").notNull(),
    category: achievementCategoryEnum("category").notNull().default("other"),
    projectId: uuid("project_id").references((): AnyPgColumn => projects.id, { onDelete: "set null" }),
    skillId: uuid("skill_id").references((): AnyPgColumn => skills.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    proofUrl: text("proof_url"),
    verificationUrl: text("verification_url"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("achievements_user_date_idx").on(t.userId, t.occurredOn)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    issuer: text("issuer"),
    issuedOn: date("issued_on").notNull(),
    expiresOn: date("expires_on"),
    credentialUrl: text("credential_url"),
    skillId: uuid("skill_id").references((): AnyPgColumn => skills.id, { onDelete: "set null" }),
    courseId: uuid("course_id").references((): AnyPgColumn => courses.id, { onDelete: "set null" }),
    achievementId: uuid("achievement_id").references((): AnyPgColumn => achievements.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("certificates_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* life                                                                */
/* ------------------------------------------------------------------ */

export const activities = pgTable(
  "activities",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("general"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ends_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    recurrence: recurrenceEnum("recurrence").notNull().default("none"),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("activities_user_idx").on(t.userId, t.startedAt)],
);

export const prayerLogs = pgTable(
  "prayer_logs",
  {
    id: id(),
    userId: userId(),
    prayer: prayerEnum("prayer").notNull(),
    day: date("day").notNull(),
    status: prayerStatusEnum("status").notNull().default("on_time"),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("prayer_logs_unique").on(t.userId, t.prayer, t.day), index("prayer_logs_day_idx").on(t.userId, t.day)],
);

export const medications = pgTable(
  "medications",
  {
    id: id(),
    userId: userId(),
    name: text("name").notNull(),
    dose: text("dose"),
    /** times of day as "HH:mm" */
    times: text("times").array().notNull().default(sql`'{}'`),
    schedule: text("schedule"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("medications_user_idx").on(t.userId, t.active)],
);

export const medicationLogs = pgTable(
  "medication_logs",
  {
    id: id(),
    userId: userId(),
    medicationId: uuid("medication_id")
      .notNull()
      .references((): AnyPgColumn => medications.id, { onDelete: "cascade" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    status: medicationLogStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("medication_logs_unique").on(t.medicationId, t.scheduledAt),
    index("medication_logs_user_idx").on(t.userId, t.scheduledAt),
  ],
);

export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: id(),
    userId: userId(),
    day: date("day").notNull(),
    mood: integer("mood"),
    body: text("body").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    /** explicit per-entry gate — the AI may never read this unless true (§28, §32) */
    aiAllowed: boolean("ai_allowed").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("diary_entries_user_day_unique").on(t.userId, t.day)],
);

export const photos = pgTable(
  "photos",
  {
    id: id(),
    userId: userId(),
    path: text("path").notNull(),
    caption: text("caption"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    location: text("location"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("photos_user_idx").on(t.userId, t.takenAt)],
);

export const timelineEvents = pgTable(
  "timeline_events",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    description: text("description"),
    occurredOn: date("occurred_on").notNull(),
    kind: achievementCategoryEnum("kind").notNull().default("milestone"),
    linkedType: linkTypeEnum("linked_type").notNull().default("none"),
    linkedId: text("linked_id"),
    importance: integer("importance").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("timeline_events_user_idx").on(t.userId, t.occurredOn)],
);

/* ------------------------------------------------------------------ */
/* growth + privacy                                                    */
/* ------------------------------------------------------------------ */

export const milestones = pgTable(
  "milestones",
  {
    id: id(),
    userId: userId(),
    title: text("title").notNull(),
    description: text("description"),
    kind: text("kind").notNull().default("personal"),
    achievedOn: date("achieved_on").notNull(),
    linkedType: linkTypeEnum("linked_type").notNull().default("none"),
    linkedId: text("linked_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("milestones_user_idx").on(t.userId, t.achievedOn)],
);

export const monthlyReflections = pgTable(
  "monthly_reflections",
  {
    id: id(),
    userId: userId(),
    /** first day of the month */
    periodStart: date("period_start").notNull(),
    learned: text("learned"),
    accomplished: text("accomplished"),
    struggled: text("struggled"),
    thinkingChanged: text("thinking_changed"),
    proudOf: text("proud_of"),
    stopDoing: text("stop_doing"),
    focusNext: text("focus_next"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("monthly_reflections_unique").on(t.userId, t.periodStart)],
);

export const aiPermissions = pgTable(
  "ai_permissions",
  {
    id: id(),
    userId: userId(),
    academic: boolean("academic").notNull().default(true),
    grades: boolean("grades").notNull().default(true),
    study: boolean("study").notNull().default(true),
    books: boolean("books").notNull().default(true),
    tasks: boolean("tasks").notNull().default(true),
    projects: boolean("projects").notNull().default(true),
    calendar: boolean("calendar").notNull().default(true),
    polymath: boolean("polymath").notNull().default(true),
    skills: boolean("skills").notNull().default(true),
    questions: boolean("questions").notNull().default(true),
    opportunities: boolean("opportunities").notNull().default(true),
    achievements: boolean("achievements").notNull().default(true),
    /** sensitive modules are OFF by default and must be explicitly granted (§32, §41) */
    diary: boolean("diary").notNull().default(false),
    photos: boolean("photos").notNull().default(false),
    medication: boolean("medication").notNull().default(false),
    prayer: boolean("prayer").notNull().default(false),
    updatedAt: updatedAt(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ai_permissions_user_unique").on(t.userId)],
);

export const aiAdvice = pgTable(
  "ai_advice",
  {
    id: id(),
    userId: userId(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    /** why the advice was given — mandatory per §24 */
    rationale: text("rationale").notNull(),
    mode: text("mode", { enum: ["deterministic", "llm"] }).notNull().default("deterministic"),
    model: text("model"),
    contextSummary: jsonb("context_summary").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_advice_user_idx").on(t.userId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* relations (used by drizzle's relational query API)                  */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  semesters: many(semesters),
  courses: many(courses),
  tasks: many(tasks),
  projects: many(projects),
  goals: many(goals),
  studySessions: many(studySessions),
  books: many(books),
  reminders: many(reminders),
  notifications: many(notifications),
  aiPermissions: one(aiPermissions),
}));

export const semestersRelations = relations(semesters, ({ one, many }) => ({
  user: one(users, { fields: [semesters.userId], references: [users.id] }),
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  user: one(users, { fields: [courses.userId], references: [users.id] }),
  semester: one(semesters, { fields: [courses.semesterId], references: [semesters.id] }),
  assessments: many(assessments),
  grades: many(grades),
  resources: many(courseResources),
  classSchedules: many(classSchedules),
  tasks: many(tasks),
  studySessions: many(studySessions),
}));

export const assessmentsRelations = relations(assessments, ({ one }) => ({
  course: one(courses, { fields: [assessments.courseId], references: [courses.id] }),
  grade: one(grades, { fields: [assessments.id], references: [grades.assessmentId] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  course: one(courses, { fields: [tasks.courseId], references: [courses.id] }),
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  goal: one(goals, { fields: [tasks.goalId], references: [goals.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  goal: one(goals, { fields: [projects.goalId], references: [goals.id] }),
  tasks: many(tasks),
}));

export const goalsRelations = relations(goals, ({ many }) => ({
  projects: many(projects),
}));

export const booksRelations = relations(books, ({ many }) => ({
  readingSessions: many(readingSessions),
  studySessions: many(studySessions),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  evidence: many(skillEvidence),
}));

export const remindersRelations = relations(reminders, ({ many }) => ({
  logs: many(reminderLogs),
}));

export const medicationsRelations = relations(medications, ({ many }) => ({
  logs: many(medicationLogs),
}));

/* ------------------------------------------------------------------ */
/* inferred types                                                      */
/* ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Semester = typeof semesters.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Grade = typeof grades.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type StudySession = typeof studySessions.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Concept = typeof concepts.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type AiPermissions = typeof aiPermissions.$inferSelect;
