/**
 * Development seed.
 *
 * Runs against a real PostgreSQL database using the same service functions the
 * application uses — nothing here writes "demo" rows that the app could not
 * produce itself. Production refuses to run this script.
 *
 *   npm run db:seed -- --confirm
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/server/db/schema";
import { createAccount, hasAnyAccount } from "../src/server/services/account";
import { createTask } from "../src/server/services/tasks";
import { createReminder } from "../src/server/services/reminders";
import {
  addPhoto,
  createActivity,
  createMedication,
  createMilestone,
  createTimelineEvent,
  logMedicationDose,
  saveDiaryEntry,
  saveReflection,
} from "../src/server/services/life";
import { createResource } from "../src/server/services/academic";
import { logReading } from "../src/server/services/books";
import { computeCourseProgress, defaultBands, gradePointForPercent } from "../src/server/services/dashboard";

const SEED_EMAIL = "afif@example.com";
const SEED_USERNAME = "afif";
const SEED_PASSWORD = "AfifOs!2026";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database.");
  }
  if (!process.argv.includes("--confirm")) {
    throw new Error('Pass --confirm to seed the development database: npm run db:seed -- --confirm');
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  /**
   * True when a row already exists in `table` matching `conditions`.
   *
   * `onConflictDoNothing()` is useless for most of this script: only a handful
   * of tables carry a unique constraint, so the insert always succeeds and
   * every re-run appends a second copy. Checking first is what makes the seed
   * idempotent.
   */
  async function exists(table: any, conditions: any): Promise<boolean> {
    const rows = await db.select({ id: table.id }).from(table).where(conditions).limit(1);
    return rows.length > 0;
  }
  const timeZone = process.env.DEFAULT_TIMEZONE ?? "Asia/Dhaka";

  // process.env is what the services read for env(); keep them consistent.
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "seed-only-secret-value-not-for-production-use-000";

  if (await hasAnyAccount()) {
    const existing = await db.select().from(schema.users).limit(1);
    console.log(`→ account already exists (${existing[0]?.email}); refreshing linked data only`);
  }

  let user = (await db.select().from(schema.users).where(eq(schema.users.email, SEED_EMAIL)).limit(1))[0];
  if (!user) {
    user = await createAccount({
      fullName: "Afif Mihran",
      username: SEED_USERNAME,
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      timezone: timeZone,
    });
    console.log(`✓ created account ${SEED_USERNAME} / ${SEED_EMAIL}`);
    console.log(`  password: ${SEED_PASSWORD}`);
  } else {
    console.log(`→ reusing existing account ${user.email}`);
  }
  const userId = user.id;

  /* ---------------- semester + courses ---------------- */
  // Look up before inserting: `semesters` has no unique constraint on the name,
  // so `onConflictDoNothing()` never fires and every run would add another
  // "Semester 1". Courses are protected by a unique index; semesters are not.
  const [existingSemester] = await db
    .select()
    .from(schema.semesters)
    .where(and(eq(schema.semesters.userId, userId), eq(schema.semesters.name, "Semester 1")))
    .limit(1);
  const [semester] = existingSemester
    ? [existingSemester]
    : await db
        .insert(schema.semesters)
        .values({
          userId,
          name: "Semester 1",
          status: "active",
          startDate: dayKey(-90),
          endDate: dayKey(60),
        })
        .returning();
  const semesterId = semester!.id;

  const courseSpecs = [
    { code: "CSE111", name: "Programming Language I", credits: "3", faculty: "SCSE", section: "7", color: "#6366f1", classes: [[1, "08:00:00", "09:30:00", "UB50301"], [3, "08:00:00", "09:30:00", "UB50301"]] },
    { code: "CSE230", name: "Data Structures", credits: "3", faculty: "SCSE", section: "2", color: "#0ea5e9", classes: [[2, "10:30:00", "12:00:00", "UB30402"], [4, "10:30:00", "12:00:00", "UB30402"]] },
    { code: "MAT110", name: "Calculus I", credits: "3", faculty: "Mathematics", section: "12", color: "#f59e0b", classes: [[0, "13:30:00", "15:00:00", "UB80201"]] },
    { code: "ENG101", name: "English for Engineers", credits: "2", faculty: "English", section: "4", color: "#10b981", classes: [[6, "11:00:00", "12:30:00", "UB10501"]] },
  ] as const;

  const courseIds: Record<string, string> = {};
  for (const spec of courseSpecs) {
    const [existing] = await db
      .select()
      .from(schema.courses)
      .where(and(eq(schema.courses.userId, userId), eq(schema.courses.semesterId, semesterId), eq(schema.courses.code, spec.code)))
      .limit(1);
    const course =
      existing ??
      (
        await db
          .insert(schema.courses)
          .values({
            userId,
            semesterId,
            code: spec.code,
            name: spec.name,
            credits: spec.credits,
            faculty: spec.faculty,
            section: spec.section,
            color: spec.color,
            status: "active",
          })
          .returning()
      )[0]!;
    courseIds[spec.code] = course.id;

    for (const [dayOfWeek, start, end, room] of spec.classes) {
      if (
        await exists(
          schema.classSchedules,
          and(
            eq(schema.classSchedules.courseId, course.id),
            eq(schema.classSchedules.dayOfWeek, dayOfWeek),
            eq(schema.classSchedules.startTime, start),
          ),
        )
      ) {
        continue;
      }
      await db
        .insert(schema.classSchedules)
        .values({ userId, courseId: course.id, dayOfWeek, startTime: start, endTime: end, room });
    }
  }
  console.log(`✓ ${Object.keys(courseIds).length} courses with weekly class schedules`);

  /* ---------------- assessments + marks ---------------- */
  const assessmentSpecs = [
    { code: "CSE111", items: [["Quiz 1", "quiz", 20, 10, 17], ["Assignment 1", "assignment", 50, 15, 42], ["Midterm", "midterm", 100, 25, 78], ["Lab 1", "lab", 30, 10, 27], ["Final", "final", 100, 40, null]] },
    { code: "CSE230", items: [["Quiz 1", "quiz", 20, 10, 15], ["Assignment 1", "assignment", 40, 15, 33], ["Midterm", "midterm", 100, 25, 69], ["Final", "final", 100, 50, null]] },
    { code: "MAT110", items: [["Quiz 1", "quiz", 25, 10, 20], ["Quiz 2", "quiz", 25, 10, 22], ["Midterm", "midterm", 100, 30, 81], ["Final", "final", 100, 50, null]] },
    { code: "ENG101", items: [["Presentation", "presentation", 30, 20, 26], ["Assignment", "assignment", 50, 20, 44], ["Final", "final", 100, 60, null]] },
  ] as const;

  let assessmentCount = 0;
  for (const spec of assessmentSpecs) {
    const courseId = courseIds[spec.code]!;
    for (const [name, kind, maxMarks, weight, obtained] of spec.items) {
      const [existing] = await db
        .select()
        .from(schema.assessments)
        .where(and(eq(schema.assessments.courseId, courseId), eq(schema.assessments.name, name)))
        .limit(1);
      const assessment =
        existing ??
        (
          await db
            .insert(schema.assessments)
            .values({
              userId,
              courseId,
              name,
              kind: kind as (typeof schema.assessmentKindEnum.enumValues)[number],
              maxMarks: String(maxMarks),
              weight: String(weight),
              scheduledFor: name === "Final" ? dayKey(35) : dayKey(-20),
            })
            .returning()
        )[0]!;
      assessmentCount += 1;

      if (obtained !== null) {
        await db
          .insert(schema.grades)
          .values({ userId, courseId, assessmentId: assessment.id, obtainedMarks: String(obtained) })
          .onConflictDoUpdate({ target: schema.grades.assessmentId, set: { obtainedMarks: String(obtained) } });
      }
    }
  }
  console.log(`✓ ${assessmentCount} assessments, graded where marks exist`);

  const bands = await defaultBands(userId);
  for (const code of Object.keys(courseIds)) {
    const course = (await db.select().from(schema.courses).where(eq(schema.courses.id, courseIds[code]!)).limit(1))[0]!;
    const rows = await db
      .select({ assessment: schema.assessments, obtainedMarks: schema.grades.obtainedMarks })
      .from(schema.assessments)
      .leftJoin(schema.grades, eq(schema.grades.assessmentId, schema.assessments.id))
      .where(eq(schema.assessments.courseId, course.id));
    const progress = computeCourseProgress(
      course,
      rows.map((row) => ({ ...row.assessment, obtainedMarks: row.obtainedMarks === null ? null : Number(row.obtainedMarks) })),
      bands,
    );
    const percent = progress.earnedPercentOfGraded;
    if (percent !== null) {
      const band = gradePointForPercent(percent, bands);
      console.log(`  ${code}: ${percent.toFixed(1)}% graded so far → ${band?.letter ?? "?"} (GP ${band?.gradePoint ?? "—"})`);
    }
  }

  /* ---------------- goals → project → tasks ---------------- */
  const GOAL_TITLE = "Become strong at full-stack development";
  const [existingGoal] = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.userId, userId), eq(schema.goals.title, GOAL_TITLE)))
    .limit(1);
  const goal =
    existingGoal ??
    (
      await db
        .insert(schema.goals)
        .values({ userId, title: GOAL_TITLE, status: "active", targetDate: dayKey(180) })
        .returning()
    )[0]!;

  const [existingProject] = await db
    .select()
    .from(schema.projects)
    .where(and(eq(schema.projects.userId, userId), eq(schema.projects.name, "Personal OS")))
    .limit(1);
  const project =
    existingProject ??
    (
      await db
        .insert(schema.projects)
        .values({
          userId,
          goalId: goal.id,
          name: "Personal OS",
          description: "A single system for academic, learning and life tracking.",
          status: "active",
          startDate: dayKey(-14),
          targetDate: dayKey(60),
        })
        .returning()
    )[0]!;
  console.log(`✓ goal → project "${project.name}"`);

  const projectTasks = ["Build authentication", "Build dashboard", "Build study timer", "Build PostgreSQL schema"];
  for (const title of projectTasks) {
    if (await exists(schema.tasks, and(eq(schema.tasks.userId, userId), eq(schema.tasks.title, title)))) continue;
    await createTask({
      userId,
      title,
      projectId: project.id,
      goalId: goal.id,
      priority: "high",
      status: title === "Build PostgreSQL schema" ? "completed" : "todo",
      dueDate: dayKey(3),
      estimatedMinutes: 90,
      category: "engineering",
    });
  }

  const studyTasks: Array<[string, string, number]> = [
    ["Finish CSE111 assignment 3", "coursework", 0],
    ["Revise MAT110 integration techniques", "study", 1],
    ["Read 30 pages of Clean Code", "reading", 0],
    ["Submit hackathon registration", "opportunity", 5],
    ["Prepare CSE230 lab report", "coursework", 2],
  ];
  for (const [title, category, offset] of studyTasks) {
    if (await exists(schema.tasks, and(eq(schema.tasks.userId, userId), eq(schema.tasks.title, title)))) continue;
    await createTask({
      userId,
      title,
      category,
      priority: offset <= 1 ? "high" : "medium",
      dueDate: dayKey(offset),
      estimatedMinutes: 60,
      courseId: title.includes("CSE111") ? courseIds.CSE111 : title.includes("MAT110") ? courseIds.MAT110 : null,
    });
  }
  if (!(await exists(schema.tasks, and(eq(schema.tasks.userId, userId), eq(schema.tasks.title, "Weekly review and planning"))))) {
  await createTask({
    userId,
    title: "Weekly review and planning",
    category: "routine",
    priority: "medium",
    dueDate: dayKey(0),
    recurrence: "weekly",
    estimatedMinutes: 45,
  });
  }
  console.log("✓ tasks across projects, courses and routines");

  /* ---------------- books ---------------- */
  const bookSpecs = [
    { title: "Clean Code", author: "Robert C. Martin", totalPages: 464, currentPage: 210, status: "reading", daily: 25 },
    { title: "Structure and Interpretation of Computer Programs", author: "Abelson & Sussman", totalPages: 657, currentPage: 88, status: "reading", daily: 15 },
    { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", totalPages: 499, currentPage: 140, status: "reading", daily: 20 },
    { title: "The Pragmatic Programmer", author: "Hunt & Thomas", totalPages: 352, currentPage: 352, status: "completed", daily: null },
    { title: "Sapiens", author: "Yuval Noah Harari", totalPages: 443, currentPage: 0, status: "want_to_read", daily: null },
  ] as const;

  for (const spec of bookSpecs) {
    const [existing] = await db
      .select()
      .from(schema.books)
      .where(and(eq(schema.books.userId, userId), eq(schema.books.title, spec.title)))
      .limit(1);
    if (existing) continue;
    await db.insert(schema.books).values({
      userId,
      title: spec.title,
      author: spec.author,
      totalPages: spec.totalPages,
      currentPage: spec.currentPage,
      status: spec.status as (typeof schema.bookStatusEnum.enumValues)[number],
      dailyPageTarget: spec.daily,
      startedAt: spec.status === "reading" || spec.status === "completed" ? new Date(Date.now() - 21 * 86_400_000) : null,
      finishedAt: spec.status === "completed" ? new Date(Date.now() - 3 * 86_400_000) : null,
      targetFinishDate: spec.status === "reading" ? dayKey(21) : null,
      rating: spec.status === "completed" ? 5 : null,
    });
  }
  console.log(`✓ ${bookSpecs.length} books`);

  /* ---------------- polymath domains ---------------- */
  const domainSpecs: Array<[string, (typeof schema.domainCategoryEnum.enumValues)[number], (typeof schema.masteryStageEnum.enumValues)[number], string[]]> = [
    ["STEM", "stem", "working_knowledge", ["Programming", "Mathematics", "Statistics", "AI/ML", "Physics"]],
    ["Business", "business", "foundation", ["Economics", "Finance", "Marketing", "Entrepreneurship"]],
    ["Human Sciences", "human_sciences", "exposure", ["Psychology", "Philosophy", "History", "Cognitive Science"]],
    ["Creation", "creation", "foundation", ["Writing", "UI/UX", "Public Speaking"]],
    ["Life & Nature", "life_nature", "exposure", ["Neuroscience", "Evolution", "Astronomy"]],
  ];

  let domainCount = 0;
  for (const [parentName, category, stage, children] of domainSpecs) {
    const [existingParent] = await db
      .select()
      .from(schema.polymathDomains)
      .where(and(eq(schema.polymathDomains.userId, userId), eq(schema.polymathDomains.name, parentName)))
      .limit(1);
    const parent =
      existingParent ??
      (
        await db
          .insert(schema.polymathDomains)
          .values({ userId, name: parentName, category, stage })
          .returning()
      )[0]!;
    domainCount += 1;
    for (const child of children) {
      if (
        await exists(
          schema.polymathDomains,
          and(eq(schema.polymathDomains.userId, userId), eq(schema.polymathDomains.name, child)),
        )
      ) {
        domainCount += 1;
        continue;
      }
      await db.insert(schema.polymathDomains).values({ userId, parentId: parent.id, name: child, category, stage });
      domainCount += 1;
    }
  }
  console.log(`✓ ${domainCount} polymath domains (stages, never percentages)`);

  /* ---------------- skills + evidence ---------------- */
  const skillSpecs: Array<[string, string, (typeof schema.masteryStageEnum.enumValues)[number], Array<[string, (typeof schema.skillEvidenceKindEnum.enumValues)[number], string | null, number | null]>]> = [
    [
      "Python",
      "programming",
      "applied",
      [
        ["CSE111 Programming Language I", "course", null, null],
        ["Personal OS", "project", null, null],
        ["Competitive programming practice", "problem_set", null, 120],
        ["Hackathon 2026 — finalist", "competition", null, null],
      ],
    ],
    ["TypeScript", "programming", "working_knowledge", [["Personal OS", "project", null, null]]],
    ["Calculus", "mathematics", "foundation", [["MAT110 Calculus I", "course", null, null]]],
    ["Public speaking", "communication", "exposure", [["ENG101 presentation", "presentation", null, null]]],
  ];

  for (const [name, category, stage, evidence] of skillSpecs) {
    const [existingSkill] = await db
      .select()
      .from(schema.skills)
      .where(and(eq(schema.skills.userId, userId), eq(schema.skills.name, name)))
      .limit(1);
    const skill =
      existingSkill ??
      (await db.insert(schema.skills).values({ userId, name, category, stage }).returning())[0]!;
    for (const [title, kind, url, metric] of evidence) {
      if (
        await exists(
          schema.skillEvidence,
          and(eq(schema.skillEvidence.skillId, skill.id), eq(schema.skillEvidence.title, title)),
        )
      ) {
        continue;
      }
      await db.insert(schema.skillEvidence).values({
        userId,
        skillId: skill.id,
        kind,
        title,
        url,
        metricValue: metric,
        metricLabel: metric !== null ? "problems solved" : null,
        occurredAt: dayKey(-30),
      });
    }
  }
  console.log(`✓ ${skillSpecs.length} skills with evidence`);

  /* ---------------- study history (self-study only) ---------------- */
  const studyPlan: Array<[number, Array<[string, string, number]>]> = [
    [0, [["CSE111", "Recursion practice", 8100], ["MAT110", "Integration by parts", 6000], ["Reading", "Clean Code chapter 5", 3000]]],
    [1, [["CSE230", "Binary search trees", 5400], ["Python", "Advent of code", 3600]]],
    [2, [["MAT110", "Series convergence", 4500], ["Reading", "SICP chapter 1", 2700]]],
    [3, [["CSE111", "Pointers and memory", 7200], ["ENG101", "Essay draft", 2400]]],
    [4, [["CSE230", "Heaps", 5100], ["Python", "FastAPI experiment", 4200]]],
    [5, [["MAT110", "Problem set 4", 5400]]],
    [6, [["Reading", "Clean Code chapter 4", 3300], ["CSE111", "Lab prep", 3000]]],
    [8, [["CSE230", "Graph traversal", 6600], ["MAT110", "Limits revision", 3600]]],
    [9, [["Python", "Testing with pytest", 5400]]],
    [10, [["CSE111", "Structs", 4800], ["Reading", "SICP chapter 2", 2100]]],
    [12, [["MAT110", "Derivatives drill", 4200], ["CSE230", "Complexity analysis", 3900]]],
  ];

  const [sessionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.studySessions)
    .where(eq(schema.studySessions.userId, userId));

  if (Number(sessionCount?.count ?? 0) === 0) {
    for (const [daysAgo, sessions] of studyPlan) {
      let cursor = new Date(Date.now() - daysAgo * 86_400_000);
      cursor.setUTCHours(3, 30, 0, 0); // ~09:30 Asia/Dhaka
      for (const [label, topic, seconds] of sessions) {
        const startedAt = new Date(cursor.getTime());
        const endedAt = new Date(startedAt.getTime() + seconds * 1000);
        await db.insert(schema.studySessions).values({
          userId,
          title: label,
          topic,
          courseId: courseIds[label] ?? null,
          startedAt,
          endedAt,
          runningSince: null,
          accumulatedSeconds: seconds,
          durationSeconds: seconds,
          status: "completed",
          lastHeartbeatAt: endedAt,
          clientKey: `seed-${randomUUID()}`,
        });
        cursor = new Date(endedAt.getTime() + 3600 * 1000);
      }
    }
    console.log(`✓ ${studyPlan.reduce((sum, [, list]) => sum + list.length, 0)} historical study sessions`);
  } else {
    console.log("→ study history already present, skipping");
  }

  /* ---------------- opportunities ---------------- */
  const opportunitySpecs = [
    ["National Collegiate Programming Contest", "competition", 12, "interested"],
    ["DhakaHack 2026", "hackathon", 26, "applied"],
    ["Chevening Scholarship", "scholarship", 90, "interested"],
    ["Undergraduate Research Fellowship", "research", 45, "interested"],
  ] as const;

  for (const [name, type, daysUntil, status] of opportunitySpecs) {
    const [existing] = await db
      .select()
      .from(schema.opportunities)
      .where(and(eq(schema.opportunities.userId, userId), eq(schema.opportunities.name, name)))
      .limit(1);
    if (existing) continue;
    await db.insert(schema.opportunities).values({
      userId,
      name,
      type: type as (typeof schema.opportunityTypeEnum.enumValues)[number],
      source: "Department noticeboard",
      deadline: dayKey(daysUntil),
      status: status as (typeof schema.opportunityStatusEnum.enumValues)[number],
      whyInterested: "Directly relevant to the skills I am building.",
      skills: ["Python", "Problem solving"],
    });
  }
  console.log(`✓ ${opportunitySpecs.length} opportunities`);

  /* ---------------- achievements ---------------- */
  const achievementSpecs: Array<[string, (typeof schema.achievementCategoryEnum.enumValues)[number], number]> = [
    ["Dean's List — Semester 1", "academic_award", -60],
    ["Hackathon 2026 — finalist", "hackathon", -30],
    ["AWS Cloud Practitioner", "certificate", -45],
  ];
  for (const [title, category, offset] of achievementSpecs) {
    const [existing] = await db
      .select()
      .from(schema.achievements)
      .where(and(eq(schema.achievements.userId, userId), eq(schema.achievements.title, title)))
      .limit(1);
    if (existing) continue;
    await db.insert(schema.achievements).values({
      userId,
      title,
      category,
      occurredOn: dayKey(offset),
      description: "Recorded with proof kept offline.",
    });
  }
  console.log(`✓ ${achievementSpecs.length} achievements`);

  /* ---------------- notes, questions, concepts ---------------- */
  if (
    !(await exists(
      schema.notes,
      and(eq(schema.notes.userId, userId), eq(schema.notes.title, "Recursion — base case first")),
    ))
  )
  await db
    .insert(schema.notes)
    .values({
      userId,
      title: "Recursion — base case first",
      body: "Always write the base case before the recursive step. Trace n=0, n=1 by hand before running.",
      courseId: courseIds.CSE111,
      tags: ["cse111", "recursion"],
    });
  if (
    !(await exists(
      schema.questions,
      and(eq(schema.questions.userId, userId), eq(schema.questions.question, "When is memoisation worse than plain recursion?")),
    ))
  )
  await db
    .insert(schema.questions)
    .values({
      userId,
      question: "When is memoisation worse than plain recursion?",
      courseId: courseIds.CSE111,
      status: "open",
    });
  if (
    !(await exists(
      schema.concepts,
      and(eq(schema.concepts.userId, userId), eq(schema.concepts.title, "Amortised analysis")),
    ))
  )
  await db
    .insert(schema.concepts)
    .values({ userId, title: "Amortised analysis", summary: "Average cost per operation over a worst-case sequence.", status: "learning" });
  console.log("✓ notes, questions and concepts");

  /* ---------------- reminders + prayer ---------------- */
  const remindAt = new Date(Date.now() + 2 * 3600 * 1000);
  if (!(await exists(schema.reminders, and(eq(schema.reminders.userId, userId), eq(schema.reminders.title, "Start evening study block"))))) {
  await createReminder({
    userId,
    title: "Start evening study block",
    description: "Two focused hours on CSE111.",
    remindAt,
    timeZone,
    priority: "high",
  });
  }
  if (!(await exists(schema.reminders, and(eq(schema.reminders.userId, userId), eq(schema.reminders.title, "Take evening medication"))))) {
  await createReminder({
    userId,
    title: "Take evening medication",
    description: "As prescribed by your doctor — Afif OS never changes doses.",
    remindAt: new Date(Date.now() + 6 * 3600 * 1000),
    timeZone,
    priority: "urgent",
  });
  }

  const today = dayKey(0);
  for (const prayer of ["fajr", "dhuhr", "asr"] as const) {
    await db
      .insert(schema.prayerLogs)
      .values({ userId, prayer, day: today, status: "on_time" })
      .onConflictDoNothing();
  }
  console.log("✓ reminders and prayer log");

  /* ---------------- life: activities, medication, diary, photos, timeline ---------------- */
  const activityCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.activities)
    .where(eq(schema.activities.userId, userId));
  if (Number(activityCount[0]?.count ?? 0) === 0) {
    // Exercise, study and rest, with real start/end times so the derived
    // duration matches what the UI will show.
    const specs: Array<[string, "exercise" | "study" | "rest" | "social" | "work", number, number]> = [
      ["Morning run at the park", "exercise", -1, 45],
      ["Evening gym session", "exercise", -2, 60],
      ["CSE111 revision block", "study", -1, 90],
      ["Deep work on Personal OS", "work", -3, 120],
      ["Friday dinner with family", "social", -4, 150],
      ["Rest and recovery", "rest", -2, 480],
    ];
    for (const [title, kind, offset, minutes] of specs) {
      const startedAt = new Date(Date.now() + offset * 86_400_000);
      startedAt.setUTCHours(7, 0, 0, 0);
      await createActivity({
        userId,
        title,
        kind,
        startedAt,
        endedAt: new Date(startedAt.getTime() + minutes * 60_000),
        notes: "Seeded through the same service the app uses.",
      });
    }
    console.log(`✓ ${specs.length} activities`);
  }

  const medicationCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.medications)
    .where(eq(schema.medications.userId, userId));
  if (Number(medicationCount[0]?.count ?? 0) === 0) {
    const vitamin = await createMedication({
      userId,
      name: "Vitamin D3",
      dose: "1000 IU",
      times: ["08:00"],
      notes: "As prescribed — Afif OS only tracks, it never recommends a change.",
    });
    await createMedication({ userId, name: "Iron supplement", dose: "65 mg", times: ["21:00"], active: false });

    // Yesterday taken, the day before missed — enough to make the adherence
    // panel show a real ratio instead of an empty state.
    await logMedicationDose({
      userId,
      medicationId: vitamin.id,
      scheduledAt: new Date(`${dayKey(-1)}T08:00:00`),
      status: "taken",
    });
    await logMedicationDose({
      userId,
      medicationId: vitamin.id,
      scheduledAt: new Date(`${dayKey(-2)}T08:00:00`),
      status: "missed",
    });
    console.log("✓ medications and dose log");
  }

  const diaryCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.diaryEntries)
    .where(eq(schema.diaryEntries.userId, userId));
  if (Number(diaryCount[0]?.count ?? 0) === 0) {
    // aiAllowed stays false: diary is private by default and the seed does not
    // silently open it to the advisor.
    await saveDiaryEntry({ userId, day: dayKey(0), body: "Shipped the Life modules today. Prayer streak held.", mood: 4 });
    await saveDiaryEntry({ userId, day: dayKey(-1), body: "Long study block, but started too late. Earlier tomorrow.", mood: 3 });
    console.log("✓ diary entries (kept private from the advisor)");
  }

  const photoCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.photos)
    .where(eq(schema.photos.userId, userId));
  if (Number(photoCount[0]?.count ?? 0) === 0) {
    await addPhoto({
      userId,
      path: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200",
      caption: "Sunrise over the hills",
      tags: ["travel", "nature"],
      location: "Sylhet",
      takenAt: new Date(Date.now() - 30 * 86_400_000),
    });
    console.log("✓ photo metadata (URL reference, no bytes stored)");
  }

  const timelineCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.timelineEvents)
    .where(eq(schema.timelineEvents.userId, userId));
  if (Number(timelineCount[0]?.count ?? 0) === 0) {
    await createTimelineEvent({ userId, title: "Started university", occurredOn: dayKey(-720), description: "First day of the CSE programme." });
    await createTimelineEvent({ userId, title: "First hackathon", occurredOn: dayKey(-210), description: "Built a scheduling tool overnight." });
    await createTimelineEvent({ userId, title: "Started Afif OS", occurredOn: dayKey(-60), description: "Began building this system." });
    await createMilestone({ userId, title: "Read 50 books", achievedOn: dayKey(-45), description: "Tracked across two years." });
    console.log("✓ timeline events and milestones");
  }

  const reflectionCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.monthlyReflections)
    .where(eq(schema.monthlyReflections.userId, userId));
  if (Number(reflectionCount[0]?.count ?? 0) === 0) {
    const periodStart = new Date().toISOString().slice(0, 7) + "-01";
    await saveReflection({
      userId,
      periodStart,
      learned: "That a system you trust beats a system that impresses you.",
      accomplished: "Shipped the analytics and life modules.",
      struggled: "Starting study blocks in the morning.",
      focusNext: "Protect the first two hours of the day.",
    });
    console.log("✓ monthly reflection");
  }

  /* ---------------- course resources + reading sessions ---------------- */
  const resourceCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.courseResources)
    .where(eq(schema.courseResources.userId, userId));
  if (Number(resourceCount[0]?.count ?? 0) === 0 && courseIds.CSE111 && courseIds.MAT110) {
    await createResource({
      userId,
      courseId: courseIds.CSE111,
      title: "Lecture slides",
      url: "https://example.com/cse111-slides",
      kind: "drive",
    });
    await createResource({
      userId,
      courseId: courseIds.CSE111,
      title: "Past final papers",
      url: "https://example.com/cse111-past",
      kind: "assignment",
      notes: "2022-2025, with marking schemes.",
    });
    await createResource({
      userId,
      courseId: courseIds.MAT110,
      title: "Khan Academy: matrices",
      url: "https://example.com/mat110-playlist",
      kind: "youtube",
    });
    console.log("✓ course resources");
  }

  const readingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.readingSessions)
    .where(eq(schema.readingSessions.userId, userId));
  if (Number(readingCount[0]?.count ?? 0) === 0) {
    const [reading] = await db
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(and(eq(schema.books.userId, userId), eq(schema.books.status, "reading")))
      .limit(1);
    if (reading) {
      for (const pages of [24, 18, 31, 12]) {
        await logReading({ userId, bookId: reading.id, pagesTo: pages, durationMinutes: 30 });
      }
      console.log("✓ reading sessions");
    }
  }

  console.log("\nSeed complete. Sign in with:");
  console.log(`  username: ${SEED_USERNAME}`);
  console.log(`  password: ${SEED_PASSWORD}`);

  await client.end({ timeout: 5 });
}

function dayKey(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error("✗ seed failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
