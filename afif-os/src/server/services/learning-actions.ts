"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import {
  addSkillEvidence,
  createConcept,
  createConnection,
  createDomain,
  createNote,
  createQuestion,
  createSkill,
  deleteConnection,
  deleteSkillEvidence,
  listConcepts,
  listConnections,
  listDomains,
  listNotes,
  listQuestions,
  listSkills,
  updateConcept,
  updateDomain,
  updateNote,
  updateQuestion,
  updateSkill,
} from "@/server/services/learning";
import {
  addEvidenceSchema,
  createConceptSchema,
  createConnectionSchema,
  createDomainSchema,
  createNoteSchema,
  createQuestionSchema,
  createSkillSchema,
  serializeConcept,
  serializeConnection,
  serializeDomain,
  serializeNote,
  serializeQuestion,
  serializeSkill,
  updateConceptSchema,
  updateDomainSchema,
  updateNoteSchema,
  updateQuestionSchema,
  updateSkillSchema,
  type SerializedConcept,
  type SerializedConnection,
  type SerializedDomain,
  type SerializedNote,
  type SerializedQuestion,
  type SerializedSkill,
} from "@/server/services/learning-validation";

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function revalidate(...paths: string[]) {
  for (const path of paths) revalidatePath(path);
  revalidatePath("/dashboard");
}

/* -------------------------------- domains --------------------------------- */

export async function createDomainAction(input: unknown): Promise<ActionResult<SerializedDomain[]>> {
  return safeAction("domain:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createDomainSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the domain details");

    await createDomain({ ...parsed.data, userId });
    const domains = await listDomains(userId);
    revalidate("/learning/polymath");
    return ok(domains.map(serializeDomain));
  });
}

export async function updateDomainAction(domainId: string, input: unknown): Promise<ActionResult<SerializedDomain[]>> {
  return safeAction("domain:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateDomainSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the domain details");

    const updated = await updateDomain(userId, domainId, parsed.data);
    if (!updated) return fail("That domain no longer exists.");

    const domains = await listDomains(userId);
    revalidate("/learning/polymath");
    return ok(domains.map(serializeDomain));
  });
}

/* -------------------------------- concepts -------------------------------- */

export async function createConceptAction(input: unknown): Promise<ActionResult<SerializedConcept>> {
  return safeAction("concept:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createConceptSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the concept details");

    const concept = await createConcept({ ...parsed.data, userId });
    const rows = await listConcepts(userId);
    const row = rows.find((item) => item.id === concept.id);
    if (!row) return fail("Could not reload the concept");
    revalidate("/learning/polymath", "/learning/notes");
    return ok(serializeConcept(row));
  });
}

export async function updateConceptAction(
  conceptId: string,
  input: unknown,
): Promise<ActionResult<SerializedConcept>> {
  return safeAction("concept:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateConceptSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the concept details");

    const updated = await updateConcept(userId, conceptId, parsed.data);
    if (!updated) return fail("That concept no longer exists.");

    const rows = await listConcepts(userId);
    const row = rows.find((item) => item.id === updated.id);
    if (!row) return fail("Could not reload the concept");
    revalidate("/learning/polymath");
    return ok(serializeConcept(row));
  });
}

/* -------------------------------- questions -------------------------------- */

export async function createQuestionAction(input: unknown): Promise<ActionResult<SerializedQuestion>> {
  return safeAction("question:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createQuestionSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the question");

    const question = await createQuestion({ ...parsed.data, userId });
    const rows = await listQuestions(userId);
    const row = rows.find((item) => item.id === question.id);
    if (!row) return fail("Could not reload the question");
    revalidate("/learning/questions", "/learning/polymath");
    return ok(serializeQuestion(row));
  });
}

export async function updateQuestionAction(
  questionId: string,
  input: unknown,
): Promise<ActionResult<SerializedQuestion>> {
  return safeAction("question:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateQuestionSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the question");

    if (parsed.data.status === "answered" && !parsed.data.answer?.trim()) {
      return fail("Write the answer before marking it answered.");
    }

    const updated = await updateQuestion(userId, questionId, parsed.data);
    if (!updated) return fail("That question no longer exists.");

    const rows = await listQuestions(userId);
    const row = rows.find((item) => item.id === updated.id);
    if (!row) return fail("Could not reload the question");
    revalidate("/learning/questions");
    return ok(serializeQuestion(row));
  });
}

/* ---------------------------------- notes ---------------------------------- */

export async function createNoteAction(input: unknown): Promise<ActionResult<SerializedNote>> {
  return safeAction("note:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createNoteSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the note");

    const note = await createNote({ ...parsed.data, userId });
    const rows = await listNotes(userId);
    const row = rows.find((item) => item.id === note.id);
    if (!row) return fail("Could not reload the note");
    revalidate("/learning/notes", "/learning/polymath");
    return ok(serializeNote(row));
  });
}

export async function updateNoteAction(noteId: string, input: unknown): Promise<ActionResult<SerializedNote>> {
  return safeAction("note:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateNoteSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the note");

    const updated = await updateNote(userId, noteId, parsed.data);
    if (!updated) return fail("That note no longer exists.");

    const rows = await listNotes(userId, { includeArchived: true });
    const row = rows.find((item) => item.id === updated.id);
    if (!row) return fail("Could not reload the note");
    revalidate("/learning/notes");
    return ok(serializeNote(row));
  });
}

/* ---------------------------------- skills --------------------------------- */

export async function createSkillAction(input: unknown): Promise<ActionResult<SerializedSkill>> {
  return safeAction("skill:create", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createSkillSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the skill details");

    const skill = await createSkill({ ...parsed.data, userId });
    const rows = await listSkills(userId);
    const row = rows.find((item) => item.id === skill.id);
    if (!row) return fail("Could not reload the skill");
    revalidate("/learning/skills", "/learning/polymath");
    return ok(serializeSkill(row));
  });
}

export async function updateSkillAction(skillId: string, input: unknown): Promise<ActionResult<SerializedSkill>> {
  return safeAction("skill:update", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = updateSkillSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the skill details");

    const updated = await updateSkill(userId, skillId, parsed.data);
    if (!updated) return fail("That skill no longer exists.");

    const rows = await listSkills(userId, true);
    const row = rows.find((item) => item.id === updated.id);
    if (!row) return fail("Could not reload the skill");
    revalidate("/learning/skills");
    return ok(serializeSkill(row));
  });
}

export async function addEvidenceAction(input: unknown): Promise<ActionResult<SerializedSkill>> {
  return safeAction("skill:addEvidence", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = addEvidenceSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the evidence details");

    const evidence = await addSkillEvidence({ ...parsed.data, userId });
    if (!evidence) return fail("That skill no longer exists.");

    const rows = await listSkills(userId);
    const row = rows.find((item) => item.id === parsed.data.skillId);
    if (!row) return fail("Could not reload the skill");
    revalidate("/learning/skills");
    return ok(serializeSkill(row));
  });
}

export async function deleteEvidenceAction(skillId: string, evidenceId: string): Promise<ActionResult<SerializedSkill>> {
  return safeAction("skill:deleteEvidence", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const removed = await deleteSkillEvidence(userId, evidenceId);
    if (!removed) return fail("That evidence no longer exists.");

    const rows = await listSkills(userId);
    const row = rows.find((item) => item.id === skillId);
    if (!row) return fail("Could not reload the skill");
    revalidate("/learning/skills");
    return ok(serializeSkill(row));
  });
}

/* ------------------------------- connections ------------------------------- */

export async function createConnectionAction(input: unknown): Promise<ActionResult<SerializedConnection[]>> {
  return safeAction("knowledge:connect", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const parsed = createConnectionSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the connection");

    try {
      await createConnection({ ...parsed.data, userId });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Could not create that connection");
    }

    const connections = await listConnections(userId);
    revalidate("/learning/polymath", "/learning/notes", "/learning/skills");
    return ok(connections.map(serializeConnection));
  });
}

export async function deleteConnectionAction(connectionId: string): Promise<ActionResult<SerializedConnection[]>> {
  return safeAction("knowledge:disconnect", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");

    const removed = await deleteConnection(userId, connectionId);
    if (!removed) return fail("That connection no longer exists.");

    const connections = await listConnections(userId);
    revalidate("/learning/polymath", "/learning/notes", "/learning/skills");
    return ok(connections.map(serializeConnection));
  });
}
