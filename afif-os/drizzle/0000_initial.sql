CREATE TYPE "public"."achievement_category" AS ENUM('academic_award', 'scholarship', 'certificate', 'competition', 'hackathon', 'research', 'conference', 'project', 'leadership', 'presentation', 'publication', 'milestone', 'other');--> statement-breakpoint
CREATE TYPE "public"."assessment_kind" AS ENUM('quiz', 'assignment', 'midterm', 'final', 'presentation', 'lab', 'other');--> statement-breakpoint
CREATE TYPE "public"."book_status" AS ENUM('want_to_read', 'reading', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."concept_status" AS ENUM('new', 'learning', 'understood', 'applied');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('active', 'completed', 'dropped', 'archived');--> statement-breakpoint
CREATE TYPE "public"."domain_category" AS ENUM('stem', 'business', 'human_sciences', 'creation', 'life_nature', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('class', 'study', 'task', 'deadline', 'exam', 'competition', 'milestone', 'book', 'activity', 'medication', 'prayer', 'personal', 'reminder');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'achieved', 'paused', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('course', 'book', 'project', 'goal', 'task', 'note', 'concept', 'question', 'skill', 'domain', 'opportunity', 'achievement', 'study_session', 'event', 'diary', 'photo', 'activity', 'none');--> statement-breakpoint
CREATE TYPE "public"."mastery_stage" AS ENUM('exposure', 'foundation', 'working_knowledge', 'applied', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."medication_log_status" AS ENUM('pending', 'taken', 'skipped', 'missed');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'web_push', 'email', 'none');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('interested', 'applied', 'accepted', 'rejected', 'completed', 'not_interested', 'archived');--> statement-breakpoint
CREATE TYPE "public"."opportunity_type" AS ENUM('competition', 'hackathon', 'scholarship', 'internship', 'research', 'conference', 'workshop', 'certification');--> statement-breakpoint
CREATE TYPE "public"."prayer_name" AS ENUM('fajr', 'dhuhr', 'asr', 'maghrib', 'isha');--> statement-breakpoint
CREATE TYPE "public"."prayer_status" AS ENUM('on_time', 'late', 'missed', 'qada');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planning', 'active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('open', 'researching', 'answered', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."reminder_log_event" AS ENUM('created', 'queued', 'sent', 'delivered', 'opened', 'completed', 'failed', 'missed', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('scheduled', 'queued', 'sent', 'delivered', 'completed', 'missed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."resource_kind" AS ENUM('drive', 'pdf', 'youtube', 'link', 'github', 'assignment', 'note', 'other');--> statement-breakpoint
CREATE TYPE "public"."semester_status" AS ENUM('planned', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."skill_evidence_kind" AS ENUM('course', 'book', 'project', 'competition', 'achievement', 'certificate', 'problem_set', 'repository', 'presentation', 'other');--> statement-breakpoint
CREATE TYPE "public"."study_status" AS ENUM('active', 'paused', 'completed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."task_bucket" AS ENUM('today', 'upcoming', 'someday');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"occurred_on" date NOT NULL,
	"category" "achievement_category" DEFAULT 'other' NOT NULL,
	"project_id" uuid,
	"skill_id" uuid,
	"course_id" uuid,
	"proof_url" text,
	"verification_url" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'general' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"duration_minutes" integer,
	"recurrence" "recurrence" DEFAULT 'none' NOT NULL,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_advice" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"rationale" text NOT NULL,
	"mode" text DEFAULT 'deterministic' NOT NULL,
	"model" text,
	"context_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"academic" boolean DEFAULT true NOT NULL,
	"grades" boolean DEFAULT true NOT NULL,
	"study" boolean DEFAULT true NOT NULL,
	"books" boolean DEFAULT true NOT NULL,
	"tasks" boolean DEFAULT true NOT NULL,
	"projects" boolean DEFAULT true NOT NULL,
	"calendar" boolean DEFAULT true NOT NULL,
	"polymath" boolean DEFAULT true NOT NULL,
	"skills" boolean DEFAULT true NOT NULL,
	"questions" boolean DEFAULT true NOT NULL,
	"opportunities" boolean DEFAULT true NOT NULL,
	"achievements" boolean DEFAULT true NOT NULL,
	"diary" boolean DEFAULT false NOT NULL,
	"photos" boolean DEFAULT false NOT NULL,
	"medication" boolean DEFAULT false NOT NULL,
	"prayer" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "assessment_kind" DEFAULT 'other' NOT NULL,
	"max_marks" numeric(8, 2) NOT NULL,
	"weight" numeric(5, 2) DEFAULT '0' NOT NULL,
	"scheduled_for" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"total_pages" integer,
	"current_page" integer DEFAULT 0 NOT NULL,
	"status" "book_status" DEFAULT 'want_to_read' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"target_finish_date" date,
	"daily_page_target" integer,
	"rating" integer,
	"review" text,
	"domain_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "event_kind" DEFAULT 'personal' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"location" text,
	"notes" text,
	"recurrence" "recurrence" DEFAULT 'none' NOT NULL,
	"course_id" uuid,
	"project_id" uuid,
	"book_id" uuid,
	"opportunity_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"issuer" text,
	"issued_on" date NOT NULL,
	"expires_on" date,
	"credential_url" text,
	"skill_id" uuid,
	"course_id" uuid,
	"achievement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"room" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"domain_id" uuid,
	"course_id" uuid,
	"book_id" uuid,
	"status" "concept_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_resources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"kind" "resource_kind" DEFAULT 'link' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"semester_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"credits" numeric(4, 2) DEFAULT '3' NOT NULL,
	"faculty" text,
	"section" text,
	"status" "course_status" DEFAULT 'active' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"awarded_grade_point" numeric(4, 2),
	"awarded_letter" text,
	"target_grade" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"mood" integer,
	"body" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"ai_allowed" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"domain_id" uuid,
	"target_date" date,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"achieved_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grades" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"obtained_marks" numeric(8, 2) NOT NULL,
	"graded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grading_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scale_max" numeric(4, 2) DEFAULT '4.00' NOT NULL,
	"bands" jsonb DEFAULT '[{"minPercent":90,"gradePoint":4,"letter":"A"},{"minPercent":85,"gradePoint":3.7,"letter":"A-"},{"minPercent":80,"gradePoint":3.3,"letter":"B+"},{"minPercent":75,"gradePoint":3,"letter":"B"},{"minPercent":70,"gradePoint":2.7,"letter":"B-"},{"minPercent":65,"gradePoint":2.3,"letter":"C+"},{"minPercent":60,"gradePoint":2,"letter":"C"},{"minPercent":55,"gradePoint":1.7,"letter":"C-"},{"minPercent":50,"gradePoint":1.3,"letter":"D+"},{"minPercent":45,"gradePoint":1,"letter":"D"},{"minPercent":0,"gradePoint":0,"letter":"F"}]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"from_type" "link_type" NOT NULL,
	"from_id" text NOT NULL,
	"to_type" "link_type" NOT NULL,
	"to_id" text NOT NULL,
	"relation" text DEFAULT 'relates_to' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"ip_address" text,
	"succeeded" boolean NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"medication_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"taken_at" timestamp with time zone,
	"status" "medication_log_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dose" text,
	"times" text[] DEFAULT '{}' NOT NULL,
	"schedule" text,
	"start_date" date,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'personal' NOT NULL,
	"achieved_on" date NOT NULL,
	"linked_type" "link_type" DEFAULT 'none' NOT NULL,
	"linked_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_reflections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"learned" text,
	"accomplished" text,
	"struggled" text,
	"thinking_changed" text,
	"proud_of" text,
	"stop_doing" text,
	"focus_next" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"source_type" "link_type" DEFAULT 'none' NOT NULL,
	"source_id" text,
	"course_id" uuid,
	"book_id" uuid,
	"concept_id" uuid,
	"project_id" uuid,
	"domain_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"kind" text DEFAULT 'info' NOT NULL,
	"action_url" text,
	"reminder_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "opportunity_type" DEFAULT 'competition' NOT NULL,
	"source" text,
	"deadline" date,
	"registration_url" text,
	"description" text,
	"why_interested" text,
	"status" "opportunity_status" DEFAULT 'interested' NOT NULL,
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"domains" text[] DEFAULT '{}' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"path" text NOT NULL,
	"caption" text,
	"taken_at" timestamp with time zone,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"location" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "polymath_domains" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"category" "domain_category" DEFAULT 'other' NOT NULL,
	"stage" "mastery_stage" DEFAULT 'exposure' NOT NULL,
	"summary" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prayer_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"prayer" "prayer_name" NOT NULL,
	"day" date NOT NULL,
	"status" "prayer_status" DEFAULT 'on_time' NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'planning' NOT NULL,
	"start_date" date,
	"target_date" date,
	"completed_at" timestamp with time zone,
	"url" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"context" text,
	"answer" text,
	"status" "question_status" DEFAULT 'open' NOT NULL,
	"course_id" uuid,
	"book_id" uuid,
	"concept_id" uuid,
	"domain_id" uuid,
	"answered_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"pages_from" integer DEFAULT 0 NOT NULL,
	"pages_to" integer DEFAULT 0 NOT NULL,
	"pages_read" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reminder_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event" "reminder_log_event" NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"remind_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	"recurrence" "recurrence" DEFAULT 'none' NOT NULL,
	"recurrence_rule" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"linked_type" "link_type" DEFAULT 'none' NOT NULL,
	"linked_id" text,
	"status" "reminder_status" DEFAULT 'scheduled' NOT NULL,
	"channel" "notification_channel" DEFAULT 'in_app' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" "semester_status" DEFAULT 'planned' NOT NULL,
	"target_cgpa" numeric(4, 2),
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"remember" boolean DEFAULT false NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"kind" "skill_evidence_kind" DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"metric_label" text,
	"metric_value" integer,
	"url" text,
	"linked_type" "link_type" DEFAULT 'none' NOT NULL,
	"linked_id" text,
	"occurred_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"stage" "mastery_stage" DEFAULT 'exposure' NOT NULL,
	"domain_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"course_id" uuid,
	"topic" text,
	"book_id" uuid,
	"project_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"accumulated_seconds" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"planned_minutes" integer,
	"status" "study_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"client_key" text,
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"bucket" "task_bucket" DEFAULT 'upcoming' NOT NULL,
	"due_date" date,
	"due_time" time,
	"estimated_minutes" integer,
	"category" text,
	"recurrence" "recurrence" DEFAULT 'none' NOT NULL,
	"recurrence_rule" text,
	"course_id" uuid,
	"project_id" uuid,
	"goal_id" uuid,
	"opportunity_id" uuid,
	"parent_id" uuid,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"occurred_on" date NOT NULL,
	"kind" "achievement_category" DEFAULT 'milestone' NOT NULL,
	"linked_type" "link_type" DEFAULT 'none' NOT NULL,
	"linked_id" text,
	"importance" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"week_starts_on" integer DEFAULT 6 NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"notification_permission" text DEFAULT 'unknown' NOT NULL,
	"push_subscription" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_advice" ADD CONSTRAINT "ai_advice_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_permissions" ADD CONSTRAINT "ai_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_domain_id_polymath_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."polymath_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_resources" ADD CONSTRAINT "course_resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_resources" ADD CONSTRAINT "course_resources_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grades" ADD CONSTRAINT "grades_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_rules" ADD CONSTRAINT "grading_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_connections" ADD CONSTRAINT "knowledge_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reflections" ADD CONSTRAINT "monthly_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_domain_id_polymath_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."polymath_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polymath_domains" ADD CONSTRAINT "polymath_domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prayer_logs" ADD CONSTRAINT "prayer_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_domain_id_polymath_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."polymath_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_reminder_id_reminders_id_fk" FOREIGN KEY ("reminder_id") REFERENCES "public"."reminders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_logs" ADD CONSTRAINT "reminder_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_domain_id_polymath_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."polymath_domains"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achievements_user_date_idx" ON "achievements" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "activities_user_idx" ON "activities" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "ai_advice_user_idx" ON "ai_advice" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_permissions_user_unique" ON "ai_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assessments_course_idx" ON "assessments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "books_user_status_idx" ON "books" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "calendar_events_user_start_idx" ON "calendar_events" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "calendar_events_kind_idx" ON "calendar_events" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "certificates_user_idx" ON "certificates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "class_schedules_user_day_idx" ON "class_schedules" USING btree ("user_id","day_of_week");--> statement-breakpoint
CREATE INDEX "concepts_user_idx" ON "concepts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_resources_course_idx" ON "course_resources" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "courses_user_semester_idx" ON "courses" USING btree ("user_id","semester_id");--> statement-breakpoint
CREATE INDEX "courses_user_status_idx" ON "courses" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_user_semester_code_unique" ON "courses" USING btree ("user_id","semester_id",lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "diary_entries_user_day_unique" ON "diary_entries" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "goals_user_status_idx" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "grades_assessment_unique" ON "grades" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "grades_course_idx" ON "grades" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_connections_unique" ON "knowledge_connections" USING btree ("from_type","from_id","to_type","to_id","relation");--> statement-breakpoint
CREATE INDEX "knowledge_connections_user_idx" ON "knowledge_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "login_attempts_identifier_idx" ON "login_attempts" USING btree ("identifier","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "medication_logs_unique" ON "medication_logs" USING btree ("medication_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "medication_logs_user_idx" ON "medication_logs" USING btree ("user_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "medications_user_idx" ON "medications" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "milestones_user_idx" ON "milestones" USING btree ("user_id","achieved_on");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_reflections_unique" ON "monthly_reflections" USING btree ("user_id","period_start");--> statement-breakpoint
CREATE INDEX "notes_user_idx" ON "notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notes_user_updated_idx" ON "notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "opportunities_user_status_idx" ON "opportunities" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "opportunities_deadline_idx" ON "opportunities" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "photos_user_idx" ON "photos" USING btree ("user_id","taken_at");--> statement-breakpoint
CREATE INDEX "polymath_domains_user_parent_idx" ON "polymath_domains" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prayer_logs_unique" ON "prayer_logs" USING btree ("user_id","prayer","day");--> statement-breakpoint
CREATE INDEX "prayer_logs_day_idx" ON "prayer_logs" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "projects_user_status_idx" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "questions_user_status_idx" ON "questions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "reading_sessions_user_idx" ON "reading_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "reminder_logs_reminder_idx" ON "reminder_logs" USING btree ("reminder_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_dedupe_unique" ON "reminders" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("status","remind_at");--> statement-breakpoint
CREATE INDEX "reminders_user_idx" ON "reminders" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "semesters_user_status_idx" ON "semesters" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skill_evidence_skill_idx" ON "skill_evidence" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skills_user_idx" ON "skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_sessions_user_started_idx" ON "study_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "study_sessions_user_status_idx" ON "study_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "study_sessions_client_key_unique" ON "study_sessions" USING btree ("user_id","client_key");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_user_due_idx" ON "tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "tasks_course_idx" ON "tasks" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "timeline_events_user_idx" ON "timeline_events" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));