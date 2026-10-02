import { and, asc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { ResourcesClient } from "@/components/academic/ResourcesClient";
import { db } from "@/server/db";
import { courses } from "@/server/db/schema";
import { listResources } from "@/server/services/academic";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const user = await requireUser();

  const [rows, courseRows] = await Promise.all([
    listResources(user.id),
    db
      .select({ id: courses.id, code: courses.code, name: courses.name })
      .from(courses)
      .where(and(eq(courses.userId, user.id), isNull(courses.archivedAt)))
      .orderBy(asc(courses.code)),
  ]);

  return <ResourcesClient rows={rows} courseOptions={courseRows} />;
}
