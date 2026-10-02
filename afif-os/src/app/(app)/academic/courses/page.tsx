import { and, asc, eq, isNull } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { CoursesClient } from "@/components/academic/CoursesClient";
import { db } from "@/server/db";
import { semesters } from "@/server/db/schema";
import { listCoursesWithStats } from "@/server/services/academic";

export const dynamic = "force-dynamic";

export default async function CoursesPage() {
  const user = await requireUser();

  const [rows, allSemesters] = await Promise.all([
    listCoursesWithStats(user.id),
    db
      .select({ id: semesters.id, name: semesters.name, status: semesters.status })
      .from(semesters)
      .where(and(eq(semesters.userId, user.id), isNull(semesters.archivedAt)))
      .orderBy(asc(semesters.startDate), asc(semesters.name)),
  ]);

  return <CoursesClient rows={rows} semesters={allSemesters.map((row) => ({ ...row, status: row.status as string }))} />;
}
