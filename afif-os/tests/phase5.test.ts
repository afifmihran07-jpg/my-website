import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { achievements, certificates, opportunities, projects, tasks, type User } from "@/server/db/schema";
import {
  achievementStats,
  achievementsByYear,
  createAchievement,
  createCertificate,
  deleteCertificate,
  listAchievements,
  listCertificates,
  updateAchievement,
} from "@/server/services/achievements";
import {
  createOpportunity,
  getOpportunity,
  listOpportunities,
  opportunityStats,
  updateOpportunity,
} from "@/server/services/opportunities";
import {
  createProject,
  getProject,
  listProjects,
  projectDetail,
  projectSummary,
  updateProject,
} from "@/server/services/projects";
import { createTask } from "@/server/services/tasks";
import { cleanupUser, makeUser } from "./helpers";

let user: User;
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  user = await makeUser("phase5");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

/* --------------------------------- projects -------------------------------- */

describe("projects", () => {
  it("derives progress from real linked tasks", async () => {
    const project = await createProject({ userId: user.id, name: "Personal OS", status: "active" });

    await createTask({ userId: user.id, title: "Build the auth layer", projectId: project.id });
    await createTask({ userId: user.id, title: "Build the study timer", projectId: project.id });
    const third = await createTask({ userId: user.id, title: "Write the docs", projectId: project.id });
    await createTask({ userId: user.id, title: "Old thing", projectId: project.id, status: "completed" });

    let loaded = await getProject(user.id, project.id);
    expect(loaded?.tasksTotal).toBe(4);
    expect(loaded?.tasksDone).toBe(1);
    expect(loaded?.taskCompletion).toBe(25);

    // Completing another task must move the number — it is not stored, it is measured.
    const { setTaskStatus } = await import("@/server/services/tasks");
    await setTaskStatus(user.id, third.id, "completed");

    loaded = await getProject(user.id, project.id);
    expect(loaded?.tasksDone).toBe(2);
    expect(loaded?.taskCompletion).toBe(50);
  });

  it("stamps completion once and clears it when reopened", async () => {
    const project = await createProject({ userId: user.id, name: "Ship it" });

    const done = await updateProject(user.id, project.id, { status: "completed" });
    expect(done?.completedAt).not.toBeNull();
    const stamp = done?.completedAt;

    const again = await updateProject(user.id, project.id, { status: "completed" });
    expect(again?.completedAt?.toISOString()).toBe(stamp?.toISOString());

    const reopened = await updateProject(user.id, project.id, { status: "active" });
    expect(reopened?.completedAt).toBeNull();
  });

  it("counts overdue target dates", async () => {
    const project = await createProject({ userId: user.id, name: "Overdue thing", targetDate: day(-5) });
    const loaded = await getProject(user.id, project.id);
    expect(loaded?.daysToTarget).toBeLessThan(0);
  });

  it("excludes other users' projects and reports a summary", async () => {
    const other = await makeUser("phase5-other");
    try {
      await createProject({ userId: other.id, name: "Not yours" });
      expect(await getProject(user.id, (await listProjects(other.id))[0]!.id)).toBeNull();

      const summary = await projectSummary(user.id);
      expect(summary.total).toBeGreaterThan(0);
      expect(summary.openTasks).toBeGreaterThan(0);
    } finally {
      await cleanupUser(other.id);
    }
  });

  it("archives rather than deletes, and the detail view keeps working", async () => {
    const project = await createProject({ userId: user.id, name: "Archive me" });
    await createTask({ userId: user.id, title: "Linked task", projectId: project.id });

    const detail = await projectDetail(user.id, project.id);
    expect(detail?.tasks).toHaveLength(1);

    await updateProject(user.id, project.id, { archived: true });
    expect((await listProjects(user.id)).some((row) => row.id === project.id)).toBe(false);
    expect((await listProjects(user.id, { includeArchived: true })).some((row) => row.id === project.id)).toBe(true);

    const row = await db.select().from(projects).where(eq(projects.id, project.id));
    expect(row).toHaveLength(1);
  });
});

/* ------------------------------- achievements ------------------------------- */

describe("achievements", () => {
  it("records a dated achievement and groups it by year", async () => {
    await createAchievement({ userId: user.id, title: "Dean's list", occurredOn: "2025-06-15", category: "academic_award" });
    await createAchievement({ userId: user.id, title: "Hackathon win", occurredOn: "2026-02-01", category: "hackathon" });

    const groups = await achievementsByYear(user.id);
    const years = groups.map((group) => group.year);
    expect(years).toContain("2025");
    expect(years).toContain("2026");
    expect(years[0]).toBe("2026"); // newest first
  });

  it("links an achievement to a skill and counts its certificates", async () => {
    const achievement = await createAchievement({
      userId: user.id,
      title: "Published a paper",
      occurredOn: day(-30),
      category: "publication",
    });

    await createCertificate({ userId: user.id, title: "Best paper certificate", issuedOn: day(-29), achievementId: achievement.id });

    const rows = await listAchievements(user.id);
    const row = rows.find((item) => item.id === achievement.id);
    expect(row?.certificateCount).toBe(1);
  });

  it("flags expired certificates and counts ones expiring soon", async () => {
    const expired = await createCertificate({ userId: user.id, title: "Old cert", issuedOn: day(-800), expiresOn: day(-400) });
    await createCertificate({ userId: user.id, title: "Soon cert", issuedOn: day(-300), expiresOn: day(30) });

    const list = await listCertificates(user.id);
    expect(list.find((item) => item.id === expired.id)?.expired).toBe(true);
    expect(list.find((item) => item.title === "Soon cert")?.expired).toBe(false);

    const stats = await achievementStats(user.id);
    expect(stats.certificates).toBeGreaterThanOrEqual(2);
    expect(stats.expiringSoon).toBeGreaterThanOrEqual(1);
  });

  it("archives achievements but deletes certificates outright", async () => {
    const achievement = await createAchievement({ userId: user.id, title: "To archive", occurredOn: day(-10) });
    await updateAchievement(user.id, achievement.id, { archived: true });
    expect((await listAchievements(user.id)).some((row) => row.id === achievement.id)).toBe(false);
    expect((await listAchievements(user.id, true)).some((row) => row.id === achievement.id)).toBe(true);

    const certificate = await createCertificate({ userId: user.id, title: "Temp cert", issuedOn: day(-1) });
    expect(await deleteCertificate(user.id, certificate.id)).toBe(true);
    const rows = await db.select().from(certificates).where(eq(certificates.id, certificate.id));
    expect(rows).toHaveLength(0);
  });

  it("rejects another user's achievement id", async () => {
    const achievement = await createAchievement({ userId: user.id, title: "Mine", occurredOn: day(-1) });
    const other = await makeUser("phase5-ach");
    try {
      expect(await updateAchievement(other.id, achievement.id, { title: "Stolen" })).toBeNull();
    } finally {
      await cleanupUser(other.id);
    }
    const [row] = await db.select().from(achievements).where(eq(achievements.id, achievement.id));
    expect(row?.title).toBe("Mine");
  });
});

/* ------------------------------ opportunities ------------------------------- */

describe("opportunities", () => {
  it("sorts by deadline and computes days left", async () => {
    await createOpportunity({ userId: user.id, name: "Closes soon", deadline: day(3), type: "hackathon" });
    await createOpportunity({ userId: user.id, name: "No deadline", type: "research" });
    await createOpportunity({ userId: user.id, name: "Later", deadline: day(60), type: "scholarship" });

    const list = await listOpportunities(user.id);
    expect(list[0]?.name).toBe("Closes soon");
    expect(list[0]?.daysLeft).toBeLessThanOrEqual(3);
    expect(list[0]?.urgency).toBe("critical");
    // Entries without a deadline sort last.
    expect(list[list.length - 1]?.name).toBe("No deadline");
  });

  it("marks a passed deadline as passed only while unresolved", async () => {
    const missed = await createOpportunity({ userId: user.id, name: "Missed it", deadline: day(-2) });
    expect((await getOpportunity(user.id, missed.id))?.urgency).toBe("passed");

    await updateOpportunity(user.id, missed.id, { status: "rejected" });
    const resolved = await getOpportunity(user.id, missed.id);
    expect(resolved?.urgency).toBe("none");
    expect(resolved?.daysLeft).toBeLessThan(0);
  });

  it("hides archived rows from the default list", async () => {
    const opportunity = await createOpportunity({ userId: user.id, name: "Archive this" });
    await updateOpportunity(user.id, opportunity.id, { archived: true });

    const list = await listOpportunities(user.id);
    expect(list.some((row) => row.id === opportunity.id)).toBe(false);

    const stats = await opportunityStats(user.id);
    const row = await db.select().from(opportunities).where(eq(opportunities.id, opportunity.id));
    expect(row[0]?.status).toBe("archived");
    expect(stats.total).toBe(list.length);
  });

  it("keeps opportunity rows scoped to their owner", async () => {
    const opportunity = await createOpportunity({ userId: user.id, name: "Only mine" });
    const other = await makeUser("phase5-opp");
    try {
      expect(await getOpportunity(other.id, opportunity.id)).toBeNull();
      expect(await updateOpportunity(other.id, opportunity.id, { name: "Hijacked" })).toBeNull();
    } finally {
      await cleanupUser(other.id);
    }
    expect((await getOpportunity(user.id, opportunity.id))?.name).toBe("Only mine");
  });

  it("splits the task table by project link without touching other rows", async () => {
    const linked = await createProject({ userId: user.id, name: "Counting check" });
    await createTask({ userId: user.id, title: "Linked", projectId: linked.id });
    await createTask({ userId: user.id, title: "Unlinked" });

    const summary = await projectSummary(user.id);
    const linkedTasks = await db.select().from(tasks).where(eq(tasks.projectId, linked.id));
    expect(linkedTasks).toHaveLength(1);
    expect(summary.openTasks).toBeGreaterThanOrEqual(1);
  });
});
