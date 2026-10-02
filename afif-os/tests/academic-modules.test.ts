import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import { courses, semesters, type User } from "@/server/db/schema";
import {
  createResource,
  deleteResource,
  listCoursesWithStats,
  listResources,
  listSemestersWithStats,
  resourceCountsByCourse,
  setActiveSemester,
  updateCourse,
  updateResource,
  updateSemester,
} from "@/server/services/academic";
import { cleanupUser, makeUser } from "./helpers";

let user: User;
let semesterA: { id: string };
let semesterB: { id: string };
let course: { id: string };

beforeAll(async () => {
  user = await makeUser("academic");

  const [a] = await db
    .insert(semesters)
    .values({ userId: user.id, name: "Spring 2026", status: "active" })
    .returning();
  semesterA = { id: a!.id };

  const [b] = await db
    .insert(semesters)
    .values({ userId: user.id, name: "Fall 2026", status: "planned" })
    .returning();
  semesterB = { id: b!.id };

  const [c] = await db
    .insert(courses)
    .values({ userId: user.id, semesterId: semesterA.id, code: "CSE111", name: "Programming Language I", credits: "3" })
    .returning();
  course = { id: c!.id };
});

afterAll(async () => {
  await cleanupUser(user.id);
});

describe("semesters", () => {
  it("reports course and assessment counts computed from the real tables", async () => {
    const rows = await listSemestersWithStats(user.id);

    expect(rows).toHaveLength(2);
    const spring = rows.find((row) => row.id === semesterA.id);
    expect(spring?.courseCount).toBe(1);
    expect(spring?.assessmentCount).toBe(0);
    // No grades recorded, so CGPA is genuinely null rather than zero.
    expect(spring?.cgpa).toBeNull();
    expect(spring?.creditsCounted).toBe(0);
  });

  it("keeps exactly one semester active at a time", async () => {
    expect(await setActiveSemester(user.id, semesterB.id)).toBe(true);

    const active = await db
      .select({ id: semesters.id })
      .from(semesters)
      .where(and(eq(semesters.userId, user.id), eq(semesters.status, "active")));
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(semesterB.id);
  });

  it("refuses to activate a semester the caller does not own", async () => {
    const other = await makeUser("academic-other");
    try {
      expect(await setActiveSemester(other.id, semesterB.id)).toBe(false);
    } finally {
      await cleanupUser(other.id);
    }
  });

  it("archives rather than deletes, and clears the active flag", async () => {
    const archived = await updateSemester(user.id, semesterB.id, { archived: true });
    expect(archived?.archivedAt).not.toBeNull();
    expect(archived?.status).toBe("planned");

    expect((await listSemestersWithStats(user.id)).some((row) => row.id === semesterB.id)).toBe(false);
    const stillThere = await db.select().from(semesters).where(eq(semesters.id, semesterB.id));
    expect(stillThere).toHaveLength(1);
  });
});

describe("courses", () => {
  it("counts assessments and graded weight from the joined grades table", async () => {
    const rows = await listCoursesWithStats(user.id);
    const row = rows.find((item) => item.id === course.id);

    expect(row?.credits).toBe(3);
    expect(row?.assessmentCount).toBe(0);
    expect(row?.gradedCount).toBe(0);
    expect(row?.totalWeight).toBe(0);
    expect(row?.gradedWeight).toBe(0);
  });

  it("updates fields and archives without deleting", async () => {
    const updated = await updateCourse(user.id, course.id, { faculty: "Dr Rahman", credits: 4 });
    expect(updated?.faculty).toBe("Dr Rahman");
    expect(Number(updated?.credits)).toBe(4);

    const archived = await updateCourse(user.id, course.id, { archived: true });
    expect(archived?.archivedAt).not.toBeNull();
    expect((await listCoursesWithStats(user.id)).some((item) => item.id === course.id)).toBe(false);

    const stillThere = await db.select().from(courses).where(eq(courses.id, course.id));
    expect(stillThere).toHaveLength(1);
  });

  it("refuses to touch a course the caller does not own", async () => {
    const other = await makeUser("academic-course");
    try {
      expect(await updateCourse(other.id, course.id, { name: "Hijacked" })).toBeNull();
    } finally {
      await cleanupUser(other.id);
    }
  });
});

describe("course resources", () => {
  let resource: { id: string };

  it("attaches a resource to a course and lists it with course details", async () => {
    await updateCourse(user.id, course.id, { archived: false });
    resource = await createResource({
      userId: user.id,
      courseId: course.id,
      title: "Lecture 3 slides",
      url: "https://example.com/slides.pdf",
      kind: "pdf",
      notes: "Covers recursion",
    });

    const rows = await listResources(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.courseCode).toBe("CSE111");
    expect(rows[0]?.kind).toBe("pdf");
  });

  it("refuses to attach a resource to a course the caller does not own", async () => {
    const other = await makeUser("academic-res");
    try {
      await expect(
        createResource({
          userId: other.id,
          courseId: course.id,
          title: "Stolen",
          url: "https://example.com",
          kind: "link",
        }),
      ).rejects.toThrow("Course not found");
    } finally {
      await cleanupUser(other.id);
    }
  });

  it("filters by course and counts per course", async () => {
    await createResource({
      userId: user.id,
      courseId: course.id,
      title: "Past paper",
      url: "https://example.com/past.pdf",
      kind: "assignment",
    });

    expect(await listResources(user.id, course.id)).toHaveLength(2);
    expect(await listResources(user.id, "00000000-0000-0000-0000-000000000000")).toHaveLength(0);

    const counts = await resourceCountsByCourse(user.id);
    expect(counts[course.id]).toBe(2);
  });

  it("updates and then deletes a resource outright", async () => {
    const updated = await updateResource(user.id, resource.id, { title: "Lecture 3 slides (revised)", kind: "drive" });
    expect(updated?.title).toBe("Lecture 3 slides (revised)");
    expect(updated?.kind).toBe("drive");

    expect(await deleteResource(user.id, resource.id)).toBe(true);
    expect(await deleteResource(user.id, resource.id)).toBe(false);
    expect(await listResources(user.id)).toHaveLength(1);
  });

  it("refuses to delete a resource the caller does not own", async () => {
    const remaining = await listResources(user.id);
    const other = await makeUser("academic-del");
    try {
      expect(await deleteResource(other.id, remaining[0]!.id)).toBe(false);
    } finally {
      await cleanupUser(other.id);
    }
    expect(await listResources(user.id)).toHaveLength(1);
  });

  it("hides resources belonging to an archived course", async () => {
    await updateCourse(user.id, course.id, { archived: true });
    expect(await listResources(user.id)).toHaveLength(0);
  });
});
