import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  achievements,
  certificates,
  courses,
  projects,
  skills,
  type Achievement,
  type Certificate,
} from "@/server/db/schema";

export type AchievementWithLinks = Achievement & {
  projectName: string | null;
  skillName: string | null;
  courseName: string | null;
  certificateCount: number;
};

export const ACHIEVEMENT_CATEGORIES = [
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
] as const;

export async function listAchievements(userId: string, includeArchived = false): Promise<AchievementWithLinks[]> {
  const conditions = [eq(achievements.userId, userId)];
  if (!includeArchived) conditions.push(isNull(achievements.archivedAt));

  const rows = await db
    .select({
      achievement: achievements,
      projectName: projects.name,
      skillName: skills.name,
      courseName: courses.name,
      certificateCount: sql<number>`(select count(*) from ${certificates} where ${certificates.achievementId} = ${achievements.id})`,
    })
    .from(achievements)
    .leftJoin(projects, eq(projects.id, achievements.projectId))
    .leftJoin(skills, eq(skills.id, achievements.skillId))
    .leftJoin(courses, eq(courses.id, achievements.courseId))
    .where(and(...conditions))
    .orderBy(desc(achievements.occurredOn));

  return rows.map(({ achievement, projectName, skillName, courseName, certificateCount }) => ({
    ...achievement,
    projectName,
    skillName,
    courseName,
    certificateCount: Number(certificateCount),
  }));
}

/** Grouped newest-first for the timeline view — real dates, nothing invented. */
export async function achievementsByYear(userId: string) {
  const rows = await listAchievements(userId);
  const groups = new Map<string, AchievementWithLinks[]>();
  for (const row of rows) {
    const year = row.occurredOn.slice(0, 4);
    const bucket = groups.get(year);
    if (bucket) bucket.push(row);
    else groups.set(year, [row]);
  }
  return [...groups.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, items]) => ({ year, items }));
}

export type CreateAchievementInput = {
  userId: string;
  title: string;
  description?: string | null;
  occurredOn: string;
  category?: Achievement["category"];
  projectId?: string | null;
  skillId?: string | null;
  courseId?: string | null;
  proofUrl?: string | null;
  verificationUrl?: string | null;
};

export async function createAchievement(input: CreateAchievementInput): Promise<Achievement> {
  const [row] = await db
    .insert(achievements)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      occurredOn: input.occurredOn,
      category: input.category ?? "other",
      projectId: input.projectId || null,
      skillId: input.skillId || null,
      courseId: input.courseId || null,
      proofUrl: input.proofUrl?.trim() || null,
      verificationUrl: input.verificationUrl?.trim() || null,
    })
    .returning();
  return row!;
}

export type UpdateAchievementInput = Partial<CreateAchievementInput> & { archived?: boolean };

export async function updateAchievement(
  userId: string,
  achievementId: string,
  patch: UpdateAchievementInput,
): Promise<Achievement | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) values.title = patch.title.trim();
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  if (patch.occurredOn !== undefined) values.occurredOn = patch.occurredOn;
  if (patch.category !== undefined) values.category = patch.category;
  if (patch.projectId !== undefined) values.projectId = patch.projectId || null;
  if (patch.skillId !== undefined) values.skillId = patch.skillId || null;
  if (patch.courseId !== undefined) values.courseId = patch.courseId || null;
  if (patch.proofUrl !== undefined) values.proofUrl = patch.proofUrl?.trim() || null;
  if (patch.verificationUrl !== undefined) values.verificationUrl = patch.verificationUrl?.trim() || null;
  if (patch.archived !== undefined) values.archivedAt = patch.archived ? new Date() : null;

  const [row] = await db
    .update(achievements)
    .set(values)
    .where(and(eq(achievements.userId, userId), eq(achievements.id, achievementId)))
    .returning();
  return row ?? null;
}

/* ------------------------------- certificates ------------------------------ */

export type CertificateWithLinks = Certificate & {
  skillName: string | null;
  courseName: string | null;
  expired: boolean;
};

export async function listCertificates(userId: string): Promise<CertificateWithLinks[]> {
  const rows = await db
    .select({ certificate: certificates, skillName: skills.name, courseName: courses.name })
    .from(certificates)
    .leftJoin(skills, eq(skills.id, certificates.skillId))
    .leftJoin(courses, eq(courses.id, certificates.courseId))
    .where(eq(certificates.userId, userId))
    .orderBy(desc(certificates.issuedOn));

  const today = new Date().toISOString().slice(0, 10);
  return rows.map(({ certificate, skillName, courseName }) => ({
    ...certificate,
    skillName,
    courseName,
    expired: Boolean(certificate.expiresOn && certificate.expiresOn < today),
  }));
}

export async function createCertificate(input: {
  userId: string;
  title: string;
  issuer?: string | null;
  issuedOn: string;
  expiresOn?: string | null;
  credentialUrl?: string | null;
  skillId?: string | null;
  courseId?: string | null;
  achievementId?: string | null;
}): Promise<Certificate> {
  const [row] = await db
    .insert(certificates)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      issuer: input.issuer?.trim() || null,
      issuedOn: input.issuedOn,
      expiresOn: input.expiresOn || null,
      credentialUrl: input.credentialUrl?.trim() || null,
      skillId: input.skillId || null,
      courseId: input.courseId || null,
      achievementId: input.achievementId || null,
    })
    .returning();
  return row!;
}

export async function deleteCertificate(userId: string, certificateId: string): Promise<boolean> {
  const [row] = await db
    .delete(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.id, certificateId)))
    .returning({ id: certificates.id });
  return Boolean(row);
}

export type AchievementStats = {
  total: number;
  thisYear: number;
  byCategory: { category: string; count: number }[];
  certificates: number;
  expiringSoon: number;
};

export async function achievementStats(userId: string): Promise<AchievementStats> {
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${achievements.archivedAt} is null)`,
      thisYear: sql<number>`count(*) filter (where extract(year from ${achievements.occurredOn}) = extract(year from now()))`,
    })
    .from(achievements)
    .where(eq(achievements.userId, userId));

  const byCategory = await db
    .select({ category: sql<string>`${achievements.category}::text`, count: sql<number>`count(*)` })
    .from(achievements)
    .where(and(eq(achievements.userId, userId), isNull(achievements.archivedAt)))
    .groupBy(achievements.category)
    .orderBy(desc(sql`count(*)`));

  const [certs] = await db
    .select({
      total: sql<number>`count(*)`,
      expiringSoon: sql<number>`count(*) filter (where ${certificates.expiresOn} is not null and ${certificates.expiresOn} <= (current_date + interval '90 days'))`,
    })
    .from(certificates)
    .where(eq(certificates.userId, userId));

  return {
    total: Number(row?.total ?? 0),
    thisYear: Number(row?.thisYear ?? 0),
    byCategory: byCategory.map((item) => ({ category: item.category, count: Number(item.count) })),
    certificates: Number(certs?.total ?? 0),
    expiringSoon: Number(certs?.expiringSoon ?? 0),
  };
}

export async function skillOptions(userId: string) {
  return db
    .select({ id: skills.id, name: skills.name })
    .from(skills)
    .where(and(eq(skills.userId, userId), isNull(skills.archivedAt)))
    .orderBy(skills.name)
    .limit(200);
}

export async function courseOptions(userId: string) {
  return db
    .select({ id: courses.id, name: courses.name, code: courses.code })
    .from(courses)
    .where(and(eq(courses.userId, userId), isNull(courses.archivedAt)))
    .orderBy(courses.code)
    .limit(200);
}
