import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { knowledgeConnections, notes, polymathDomains, questions, skills, type User } from "@/server/db/schema";
import {
  addSkillEvidence,
  connectionsFor,
  createConcept,
  createConnection,
  createDomain,
  createNote,
  createQuestion,
  createSkill,
  deleteConnection,
  deleteSkillEvidence,
  flattenDomains,
  learningStats,
  listConcepts,
  listConnections,
  listDomains,
  listNotes,
  listQuestions,
  listSkills,
  noteTags,
  stageFromEvidenceCount,
  updateConcept,
  updateDomain,
  updateNote,
  updateQuestion,
  updateSkill,
} from "@/server/services/learning";
import { createBook } from "@/server/services/books";
import { cleanupUser, makeUser } from "./helpers";

let user: User;

beforeAll(async () => {
  user = await makeUser("learning");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

/* ------------------------------- domains ---------------------------------- */

describe("polymath domains", () => {
  it("nests children under parents and counts what lives in each domain", async () => {
    const parent = await createDomain({ userId: user.id, name: "Computer Science", category: "stem" });
    const child = await createDomain({ userId: user.id, name: "Distributed Systems", category: "stem", parentId: parent.id });

    await createConcept({ userId: user.id, title: "Consensus", domainId: child.id });
    await createSkill({ userId: user.id, name: "Consensus protocols", domainId: child.id });
    await createNote({ userId: user.id, title: "Raft notes", domainId: child.id });

    const tree = await listDomains(user.id);
    const root = tree.find((domain) => domain.id === parent.id);
    expect(root).toBeDefined();
    expect(root?.children.map((item) => item.id)).toContain(child.id);

    const node = root?.children.find((item) => item.id === child.id);
    expect(node?.conceptCount).toBe(1);
    expect(node?.skillCount).toBe(1);
    expect(node?.noteCount).toBe(1);
  });

  it("attributes reading time to a domain through its books", async () => {
    const domain = await createDomain({ userId: user.id, name: "Physics", category: "stem" });
    const book = await createBook({ userId: user.id, title: "Feynman Lectures", totalPages: 500, domainId: domain.id });

    const { logReading } = await import("@/server/services/books");
    await logReading({ userId: user.id, bookId: book.id, pagesTo: 60, durationMinutes: 90 });

    const tree = await listDomains(user.id);
    const flat = tree.flatMap((domain2) => [domain2, ...domain2.children]);
    const node = flat.find((item) => item.id === domain.id);
    // Reading time is reading time — it must not leak into the study total.
    expect(node?.readingSeconds).toBe(90 * 60);
    expect(node?.studySeconds).toBe(0);
  });

  it("archives a domain without deleting it", async () => {
    const domain = await createDomain({ userId: user.id, name: "Abandoned interest" });
    await updateDomain(user.id, domain.id, { archived: true });

    const flat = await flattenDomains(user.id);
    expect(flat.some((item) => item.id === domain.id)).toBe(false);

    // Archived, not deleted: the row is still in the table.
    const row = await db.select().from(polymathDomains).where(eq(polymathDomains.id, domain.id));
    expect(row).toHaveLength(1);
    expect(row[0]?.archivedAt).not.toBeNull();
  });

  it("keeps another user's domain out of reach", async () => {
    const domain = await createDomain({ userId: user.id, name: "Mine only" });
    const other = await makeUser("learning-other");
    try {
      expect(await updateDomain(other.id, domain.id, { name: "Stolen" })).toBeNull();
    } finally {
      await cleanupUser(other.id);
    }
    const flat = await flattenDomains(user.id);
    expect(flat.find((item) => item.id === domain.id)?.name).toBe("Mine only");
  });
});

/* ------------------------------- concepts --------------------------------- */

describe("concepts", () => {
  it("tracks understanding status and linked notes/questions", async () => {
    const concept = await createConcept({ userId: user.id, title: "Entropy", summary: "Measure of disorder" });
    expect(concept.status).toBe("new");

    await createNote({ userId: user.id, title: "Entropy worked example", conceptId: concept.id });
    await createQuestion({ userId: user.id, question: "Why does entropy always increase?", conceptId: concept.id });

    const rows = await listConcepts(user.id);
    const row = rows.find((item) => item.id === concept.id);
    expect(row?.noteCount).toBe(1);
    expect(row?.questionCount).toBe(1);

    const updated = await updateConcept(user.id, concept.id, { status: "understood" });
    expect(updated?.status).toBe("understood");

    const filtered = await listConcepts(user.id, { status: "understood" });
    expect(filtered.some((item) => item.id === concept.id)).toBe(true);
    const notFiltered = await listConcepts(user.id, { status: "new" });
    expect(notFiltered.some((item) => item.id === concept.id)).toBe(false);
  });
});

/* ------------------------------- questions -------------------------------- */

describe("questions", () => {
  it("stamps answeredAt once and clears it when reopened", async () => {
    const question = await createQuestion({ userId: user.id, question: "What is a manifold?" });
    expect(question.answeredAt).toBeNull();
    expect(question.status).toBe("open");

    const answered = await updateQuestion(user.id, question.id, { answer: "A space that locally looks flat.", status: "answered" });
    expect(answered?.answeredAt).not.toBeNull();
    const stamp = answered?.answeredAt;

    const again = await updateQuestion(user.id, question.id, { status: "answered" });
    expect(again?.answeredAt?.toISOString()).toBe(stamp?.toISOString());

    const reopened = await updateQuestion(user.id, question.id, { status: "researching" });
    expect(reopened?.answeredAt).toBeNull();
  });

  it("sorts open questions first and reports how long they have been open", async () => {
    await createQuestion({ userId: user.id, question: "Answered one" });
    const open = await createQuestion({ userId: user.id, question: "Still open one" });

    const rows = await listQuestions(user.id);
    expect(rows[0]?.status === "open" || rows[0]?.status === "researching").toBe(true);
    expect(rows.find((row) => row.id === open.id)?.openDays).toBe(0);
  });

  it("archives questions instead of deleting", async () => {
    const question = await createQuestion({ userId: user.id, question: "To archive" });
    await updateQuestion(user.id, question.id, { archived: true });

    expect((await listQuestions(user.id)).some((row) => row.id === question.id)).toBe(false);
    const row = await db.select().from(questions).where(eq(questions.id, question.id));
    expect(row).toHaveLength(1);
  });
});

/* --------------------------------- notes ---------------------------------- */

describe("notes", () => {
  it("stores tags, pins, and filters by both", async () => {
    const pinned = await createNote({ userId: user.id, title: "Core definitions", tags: ["maths", "reference"], pinned: true });
    await createNote({ userId: user.id, title: "Random thought", tags: ["maths"] });

    const tags = await noteTags(user.id);
    expect(tags.find((tag) => tag.tag === "maths")?.count).toBe(2);

    const all = await listNotes(user.id);
    expect(all[0]?.id).toBe(pinned.id); // pinned first

    const filtered = await listNotes(user.id, { tag: "reference" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe(pinned.id);
  });

  it("searches title and body with LIKE metacharacters escaped", async () => {
    await createNote({ userId: user.id, title: "Escaping % and _ test", body: "literal percent sign" });

    const hit = await listNotes(user.id, { search: "literal percent" });
    expect(hit.length).toBeGreaterThanOrEqual(1);

    // "%" must not behave as a wildcard matching everything.
    const wildcard = await listNotes(user.id, { search: "%" });
    expect(wildcard).toHaveLength(0);
  });

  it("counts the connections attached to a note", async () => {
    const note = await createNote({ userId: user.id, title: "Connected note" });
    const concept = await createConcept({ userId: user.id, title: "Bayes theorem" });

    await createConnection({ userId: user.id, fromType: "note", fromId: note.id, toType: "concept", toId: concept.id });

    const rows = await listNotes(user.id);
    expect(rows.find((row) => row.id === note.id)?.connectionCount).toBe(1);
  });

  it("archives notes without deleting them", async () => {
    const note = await createNote({ userId: user.id, title: "Old note" });
    await updateNote(user.id, note.id, { archived: true });

    expect((await listNotes(user.id)).some((row) => row.id === note.id)).toBe(false);
    const row = await db.select().from(notes).where(eq(notes.id, note.id));
    expect(row).toHaveLength(1);
  });
});

/* --------------------------------- skills --------------------------------- */

describe("skills and evidence", () => {
  it("never stores a percentage — only a stage plus evidence rows", async () => {
    const skill = await createSkill({ userId: user.id, name: "TypeScript", stage: "foundation" });

    const row = await db.select().from(skills).where(eq(skills.id, skill.id));
    expect(row[0]?.stage).toBe("foundation");
    // The table has no percentage column to hide behind.
    expect(Object.keys(row[0]!)).not.toContain("percentage");
    expect(Object.keys(row[0]!)).not.toContain("level_percent");
  });

  it("suggests a stage from evidence count using published thresholds", async () => {
    expect(stageFromEvidenceCount(0)).toBe("exposure");
    expect(stageFromEvidenceCount(1)).toBe("foundation");
    expect(stageFromEvidenceCount(3)).toBe("working_knowledge");
    expect(stageFromEvidenceCount(5)).toBe("applied");
    expect(stageFromEvidenceCount(8)).toBe("advanced");
    expect(stageFromEvidenceCount(99)).toBe("advanced"); // capped, never beyond advanced
  });

  it("adds evidence and reports the count alongside the user's own stage", async () => {
    const skill = await createSkill({ userId: user.id, name: "Public speaking", stage: "exposure" });

    await addSkillEvidence({ userId: user.id, skillId: skill.id, title: "Gave a 20-minute talk", kind: "presentation" });
    await addSkillEvidence({ userId: user.id, skillId: skill.id, title: "Workshop facilitator", kind: "other", metricLabel: "attendees", metricValue: 40 });

    const rows = await listSkills(user.id);
    const row = rows.find((item) => item.id === skill.id);
    expect(row?.evidenceCount).toBe(2);
    // The user's chosen stage is the truth; the suggestion is shown separately.
    expect(row?.stage).toBe("exposure");
    expect(row?.suggestedStage).toBe("foundation");
  });

  it("refuses evidence for a skill the caller does not own", async () => {
    const skill = await createSkill({ userId: user.id, name: "Guarded skill" });
    const other = await makeUser("learning-ev");
    try {
      expect(await addSkillEvidence({ userId: other.id, skillId: skill.id, title: "Not mine" })).toBeNull();
      expect(await deleteSkillEvidence(other.id, skill.id)).toBe(false);
    } finally {
      await cleanupUser(other.id);
    }
  });

  it("removes evidence rows when asked", async () => {
    const skill = await createSkill({ userId: user.id, name: "Temporary skill" });
    const evidence = await addSkillEvidence({ userId: user.id, skillId: skill.id, title: "To delete" });

    expect(await deleteSkillEvidence(user.id, evidence!.id)).toBe(true);
    const rows = await listSkills(user.id);
    expect(rows.find((item) => item.id === skill.id)?.evidenceCount).toBe(0);
  });

  it("updates a skill stage explicitly", async () => {
    const skill = await createSkill({ userId: user.id, name: "Stage skill" });
    const updated = await updateSkill(user.id, skill.id, { stage: "applied" });
    expect(updated?.stage).toBe("applied");
  });
});

/* ------------------------------ connections ------------------------------- */

describe("knowledge connections", () => {
  it("links two real items and resolves their labels", async () => {
    const note = await createNote({ userId: user.id, title: "Graph note" });
    const skill = await createSkill({ userId: user.id, name: "Graph theory" });

    const result = await createConnection({
      userId: user.id,
      fromType: "note",
      fromId: note.id,
      toType: "skill",
      toId: skill.id,
      relation: "supports",
    });
    expect(result.created).toBe(true);

    const connections = await listConnections(user.id);
    const row = connections.find((item) => item.id === result.connection.id);
    expect(row?.fromLabel).toBe("Graph note");
    expect(row?.toLabel).toBe("Graph theory");
  });

  it("does not create the same connection twice", async () => {
    const note = await createNote({ userId: user.id, title: "Dedupe note" });
    const concept = await createConcept({ userId: user.id, title: "Dedupe concept" });

    const first = await createConnection({ userId: user.id, fromType: "note", fromId: note.id, toType: "concept", toId: concept.id });
    const second = await createConnection({ userId: user.id, fromType: "note", fromId: note.id, toType: "concept", toId: concept.id });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.connection.id).toBe(first.connection.id);
  });

  it("rejects self-links", async () => {
    const note = await createNote({ userId: user.id, title: "Self link" });
    await expect(
      createConnection({ userId: user.id, fromType: "note", fromId: note.id, toType: "note", toId: note.id }),
    ).rejects.toThrow(/itself/);
  });

  it("rejects connections to another user's items", async () => {
    const other = await makeUser("learning-conn");
    try {
      const theirs = await createNote({ userId: other.id, title: "Their note" });
      const mine = await createNote({ userId: user.id, title: "My note" });

      await expect(
        createConnection({ userId: user.id, fromType: "note", fromId: mine.id, toType: "note", toId: theirs.id }),
      ).rejects.toThrow(/does not belong to you/);
    } finally {
      await cleanupUser(other.id);
    }
  });

  it("returns neighbours in both directions with a direction marker", async () => {
    const note = await createNote({ userId: user.id, title: "Hub note" });
    const conceptA = await createConcept({ userId: user.id, title: "Concept A" });
    const conceptB = await createConcept({ userId: user.id, title: "Concept B" });

    await createConnection({ userId: user.id, fromType: "note", fromId: note.id, toType: "concept", toId: conceptA.id });
    await createConnection({ userId: user.id, fromType: "concept", fromId: conceptB.id, toType: "note", toId: note.id });

    const neighbours = await connectionsFor(user.id, "note", note.id);
    expect(neighbours).toHaveLength(2);
    expect(neighbours.map((item) => item.direction).sort()).toEqual(["in", "out"]);
    expect(neighbours.map((item) => item.otherLabel).sort()).toEqual(["Concept A", "Concept B"]);
  });

  it("deletes a connection", async () => {
    const note = await createNote({ userId: user.id, title: "Delete conn note" });
    const concept = await createConcept({ userId: user.id, title: "Delete conn concept" });
    const { connection } = await createConnection({ userId: user.id, fromType: "note", fromId: note.id, toType: "concept", toId: concept.id });

    expect(await deleteConnection(user.id, connection.id)).toBe(true);
    const rows = await db.select().from(knowledgeConnections).where(eq(knowledgeConnections.id, connection.id));
    expect(rows).toHaveLength(0);
    expect(await deleteConnection(user.id, connection.id)).toBe(false);
  });
});

/* --------------------------------- stats ---------------------------------- */

describe("learning stats", () => {
  it("counts every module from the real tables", async () => {
    const stats = await learningStats(user.id);

    expect(stats.domains).toBeGreaterThan(0);
    expect(stats.concepts).toBeGreaterThan(0);
    expect(stats.notes).toBeGreaterThan(0);
    expect(stats.skills).toBeGreaterThan(0);
    expect(stats.evidence).toBeGreaterThan(0);
    expect(stats.connections).toBeGreaterThan(0);

    // Stage buckets must add up to the skill total.
    const stageTotal = stats.skillsByStage.reduce((sum, bucket) => sum + bucket.count, 0);
    expect(stageTotal).toBe(stats.skills);
    expect(stats.skillsByStage.map((bucket) => bucket.stage)).toEqual([
      "exposure",
      "foundation",
      "working_knowledge",
      "applied",
      "advanced",
    ]);
  });
});
