import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { opportunities, type Opportunity } from "@/server/db/schema";
import { calendarDaysUntil } from "@/server/services/projects";

export type OpportunityType = Opportunity["type"];
export type OpportunityStatus = Opportunity["status"];

export const OPPORTUNITY_TYPES: OpportunityType[] = [
  "competition",
  "hackathon",
  "scholarship",
  "internship",
  "research",
  "conference",
  "workshop",
  "certification",
];

export const OPPORTUNITY_STATUSES: OpportunityStatus[] = [
  "interested",
  "applied",
  "accepted",
  "rejected",
  "completed",
  "not_interested",
  "archived",
];

export type OpportunityWithDeadline = Opportunity & {
  /** days until the deadline; negative = missed it */
  daysLeft: number | null;
  /** set once the deadline is within this many days and not yet resolved */
  urgency: "none" | "soon" | "critical" | "passed";
};

function decorate(opportunity: Opportunity): OpportunityWithDeadline {
  let daysLeft: number | null = null;
  let urgency: OpportunityWithDeadline["urgency"] = "none";

  if (opportunity.deadline) {
    daysLeft = calendarDaysUntil(opportunity.deadline);
    const resolved = ["accepted", "rejected", "completed", "not_interested", "archived"].includes(opportunity.status);
    if (!resolved) {
      if (daysLeft < 0) urgency = "passed";
      else if (daysLeft <= 7) urgency = "critical";
      else if (daysLeft <= 30) urgency = "soon";
    }
  }

  return { ...opportunity, daysLeft, urgency };
}

export async function listOpportunities(
  userId: string,
  filter: { type?: OpportunityType | "all"; status?: OpportunityStatus | "all"; includeArchived?: boolean } = {},
): Promise<OpportunityWithDeadline[]> {
  const conditions = [eq(opportunities.userId, userId)];
  if (!filter.includeArchived) {
    conditions.push(isNull(opportunities.archivedAt));
    conditions.push(sql`${opportunities.status} <> 'archived'`);
  }
  if (filter.type && filter.type !== "all") conditions.push(eq(opportunities.type, filter.type));
  if (filter.status && filter.status !== "all") conditions.push(eq(opportunities.status, filter.status));

  const rows = await db
    .select()
    .from(opportunities)
    .where(and(...conditions))
    .orderBy(
      sql`case when ${opportunities.deadline} is null then 1 else 0 end`,
      asc(opportunities.deadline),
      desc(opportunities.updatedAt),
    );

  return rows.map(decorate);
}

export async function getOpportunity(userId: string, opportunityId: string): Promise<OpportunityWithDeadline | null> {
  const [row] = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), eq(opportunities.id, opportunityId)))
    .limit(1);
  return row ? decorate(row) : null;
}

export type CreateOpportunityInput = {
  userId: string;
  name: string;
  type?: OpportunityType;
  source?: string | null;
  deadline?: string | null;
  registrationUrl?: string | null;
  description?: string | null;
  whyInterested?: string | null;
  status?: OpportunityStatus;
  reminderEnabled?: boolean;
  skills?: string[];
  domains?: string[];
};

export async function createOpportunity(input: CreateOpportunityInput): Promise<Opportunity> {
  const [row] = await db
    .insert(opportunities)
    .values({
      userId: input.userId,
      name: input.name.trim(),
      type: input.type ?? "competition",
      source: input.source?.trim() || null,
      deadline: input.deadline || null,
      registrationUrl: input.registrationUrl?.trim() || null,
      description: input.description?.trim() || null,
      whyInterested: input.whyInterested?.trim() || null,
      status: input.status ?? "interested",
      reminderEnabled: input.reminderEnabled ?? false,
      skills: input.skills ?? [],
      domains: input.domains ?? [],
    })
    .returning();
  return row!;
}

export type UpdateOpportunityInput = Partial<CreateOpportunityInput> & { archived?: boolean };

export async function updateOpportunity(
  userId: string,
  opportunityId: string,
  patch: UpdateOpportunityInput,
): Promise<Opportunity | null> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.type !== undefined) values.type = patch.type;
  if (patch.source !== undefined) values.source = patch.source?.trim() || null;
  if (patch.deadline !== undefined) values.deadline = patch.deadline || null;
  if (patch.registrationUrl !== undefined) values.registrationUrl = patch.registrationUrl?.trim() || null;
  if (patch.description !== undefined) values.description = patch.description?.trim() || null;
  if (patch.whyInterested !== undefined) values.whyInterested = patch.whyInterested?.trim() || null;
  if (patch.status !== undefined) values.status = patch.status;
  if (patch.reminderEnabled !== undefined) values.reminderEnabled = patch.reminderEnabled;
  if (patch.skills !== undefined) values.skills = patch.skills;
  if (patch.domains !== undefined) values.domains = patch.domains;
  if (patch.archived !== undefined) {
    values.archivedAt = patch.archived ? new Date() : null;
    if (patch.archived) values.status = "archived";
  }

  const [row] = await db
    .update(opportunities)
    .set(values)
    .where(and(eq(opportunities.userId, userId), eq(opportunities.id, opportunityId)))
    .returning();
  return row ?? null;
}

export type OpportunityStats = {
  total: number;
  applied: number;
  accepted: number;
  upcomingDeadlines: number;
  missed: number;
  byType: { type: string; count: number }[];
};

export async function opportunityStats(userId: string): Promise<OpportunityStats> {
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${opportunities.archivedAt} is null and ${opportunities.status} <> 'archived')`,
      applied: sql<number>`count(*) filter (where ${opportunities.status} = 'applied')`,
      accepted: sql<number>`count(*) filter (where ${opportunities.status} = 'accepted')`,
      upcomingDeadlines: sql<number>`count(*) filter (where ${opportunities.deadline} >= current_date and ${opportunities.status} in ('interested', 'applied'))`,
      missed: sql<number>`count(*) filter (where ${opportunities.deadline} < current_date and ${opportunities.status} in ('interested', 'applied'))`,
    })
    .from(opportunities)
    .where(eq(opportunities.userId, userId));

  const byType = await db
    .select({ type: sql<string>`${opportunities.type}::text`, count: sql<number>`count(*)` })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), isNull(opportunities.archivedAt)))
    .groupBy(opportunities.type)
    .orderBy(desc(sql`count(*)`));

  return {
    total: Number(row?.total ?? 0),
    applied: Number(row?.applied ?? 0),
    accepted: Number(row?.accepted ?? 0),
    upcomingDeadlines: Number(row?.upcomingDeadlines ?? 0),
    missed: Number(row?.missed ?? 0),
    byType: byType.map((item) => ({ type: item.type, count: Number(item.count) })),
  };
}

export async function opportunityOptions(userId: string) {
  return db
    .select({ id: opportunities.id, name: opportunities.name, status: opportunities.status })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), isNull(opportunities.archivedAt)))
    .orderBy(desc(opportunities.updatedAt))
    .limit(200);
}
