import "server-only";
import { z } from "zod";

import { dateKey, iso, optionalText, optionalUrl, tagList } from "@/server/services/common-validation";
import type { OpportunityWithDeadline } from "@/server/services/opportunities";
import { OPPORTUNITY_STATUS_NAMES, OPPORTUNITY_TYPE_NAMES } from "@/lib/labels";

export const opportunityType = z.enum(OPPORTUNITY_TYPE_NAMES);

export const opportunityStatus = z.enum(OPPORTUNITY_STATUS_NAMES);

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

