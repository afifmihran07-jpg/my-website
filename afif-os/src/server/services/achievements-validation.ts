import "server-only";
import { z } from "zod";

import { dateKey, iso, optionalText, optionalUrl, uuid } from "@/server/services/common-validation";
import type { AchievementWithLinks, CertificateWithLinks } from "@/server/services/achievements";
import { ACHIEVEMENT_CATEGORY_NAMES } from "@/lib/labels";

export const achievementCategory = z.enum(ACHIEVEMENT_CATEGORY_NAMES);

const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const createAchievementSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  description: optionalText(4000, "Description"),
  occurredOn: requiredDate,
  category: achievementCategory.default("other"),
  projectId: uuid,
  skillId: uuid,
  courseId: uuid,
  proofUrl: optionalUrl,
  verificationUrl: optionalUrl,
});

export const updateAchievementSchema = createAchievementSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const createCertificateSchema = z.object({
  title: z.string().trim().min(1, "Give the certificate a title").max(200),
  issuer: optionalText(160, "Issuer"),
  issuedOn: requiredDate,
  expiresOn: dateKey,
  credentialUrl: optionalUrl,
  skillId: uuid,
  courseId: uuid,
  achievementId: uuid,
});

export function serializeAchievement(achievement: AchievementWithLinks) {
  return {
    id: achievement.id,
    title: achievement.title,
    description: achievement.description,
    occurredOn: achievement.occurredOn,
    category: achievement.category,
    projectId: achievement.projectId,
    projectName: achievement.projectName,
    skillId: achievement.skillId,
    skillName: achievement.skillName,
    courseId: achievement.courseId,
    courseName: achievement.courseName,
    proofUrl: achievement.proofUrl,
    verificationUrl: achievement.verificationUrl,
    certificateCount: achievement.certificateCount,
    createdAt: iso(achievement.createdAt),
  };
}

export type SerializedAchievement = ReturnType<typeof serializeAchievement>;

export function serializeCertificate(certificate: CertificateWithLinks) {
  return {
    id: certificate.id,
    title: certificate.title,
    issuer: certificate.issuer,
    issuedOn: certificate.issuedOn,
    expiresOn: certificate.expiresOn,
    credentialUrl: certificate.credentialUrl,
    skillId: certificate.skillId,
    skillName: certificate.skillName,
    courseId: certificate.courseId,
    courseName: certificate.courseName,
    expired: certificate.expired,
  };
}

export type SerializedCertificate = ReturnType<typeof serializeCertificate>;

