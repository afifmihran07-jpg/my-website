import "server-only";
import { z } from "zod";

import { dateKey, iso, optionalText, optionalUrl, tagList } from "@/server/services/common-validation";
import type { OpportunityWithDeadline } from "@/server/services/opportunities";

export const opportunityType = z.enum([
  "competition",
  "hackathon",
  "scholarship",
  "internship",
  "research",
  "conference",
  "workshop",
  "certification",
]);

export const opportunityStatus = z.enum([
  "interested",
  "applied",
  "accepted",
  "rejected",
  "completed",
  "not_interested",
  "archived",
]);

export const createOpportunitySchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(200),
  type: opportunityType.default("competition"),
  source: optionalText(200, "Source"),
  deadline: dateKey,
  registrationUrl: optionalUrl,
  description: optionalText(4000, "Description"),
  whyInterested: optionalText(2000, "Reason"),
  status: opportunityStatus.default("interested"),
  reminderEnabled: z.boolean().optional(),
  skills: tagList,
  domains: tagList,
});

export const updateOpportunitySchema = createOpportunitySchema.partial().extend({
  archived: z.boolean().optional(),
});

export function serializeOpportunity(opportunity: OpportunityWithDeadline) {
  return {
    id: opportunity.id,
    name: opportunity.name,
    type: opportunity.type,
    source: opportunity.source,
    deadline: opportunity.deadline,
    registrationUrl: opportunity.registrationUrl,
    description: opportunity.description,
    whyInterested: opportunity.whyInterested,
    status: opportunity.status,
    reminderEnabled: opportunity.reminderEnabled,
    skills: opportunity.skills,
    domains: opportunity.domains,
    daysLeft: opportunity.daysLeft,
    urgency: opportunity.urgency,
    createdAt: iso(opportunity.createdAt),
    updatedAt: iso(opportunity.updatedAt),
  };
}

export type SerializedOpportunity = ReturnType<typeof serializeOpportunity>;

export const OPPORTUNITY_TYPE_LABELS: Record<z.infer<typeof opportunityType>, string> = {
  competition: "Competitions",
  hackathon: "Hackathons",
  scholarship: "Scholarships",
  internship: "Internships",
  research: "Research",
  conference: "Conferences",
  workshop: "Workshops",
  certification: "Certifications",
};

export const OPPORTUNITY_STATUS_LABELS: Record<z.infer<typeof opportunityStatus>, string> = {
  interested: "Interested",
  applied: "Applied",
  accepted: "Accepted",
  rejected: "Rejected",
  completed: "Completed",
  not_interested: "Not interested",
  archived: "Archived",
};

export const OPPORTUNITY_STATUS_TONES: Record<
  z.infer<typeof opportunityStatus>,
  "neutral" | "primary" | "accent" | "warning" | "danger"
> = {
  interested: "neutral",
  applied: "accent",
  accepted: "primary",
  rejected: "danger",
  completed: "primary",
  not_interested: "neutral",
  archived: "neutral",
};
