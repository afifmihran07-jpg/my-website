"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import {
  StudyError,
  discardStudy,
  pauseStudy,
  resumeStudy,
  startStudy,
  stopStudy,
  toStudyDto,
  type StudyDto,
} from "@/server/services/study";

const startSchema = z.object({
  title: z.string().trim().min(2, "What are you studying?").max(180),
  courseId: z.string().uuid().optional().nullable(),
  topic: z.string().trim().max(180).optional().nullable(),
  bookId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  plannedMinutes: z.coerce.number().int().min(1).max(12 * 60).optional().nullable(),
  clientKey: z.string().min(8).max(120).optional().nullable(),
});

async function currentUserId(): Promise<string | null> {
  const record = await getSessionUser();
  return record?.user.id ?? null;
}

function studyErrorMessage(error: unknown): string {
  if (error instanceof StudyError) return error.message;
  return "Study session could not be saved. Your timer state is still stored on the server — reload the Study Timer page and try again.";
}

export async function startStudyAction(input: unknown): Promise<ActionResult<StudyDto>> {
  return safeAction("study:start", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in to start a session.");
    const parsed = startSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid session details");
    try {
      const session = await startStudy({ ...parsed.data, userId });
      revalidatePath("/dashboard");
      return ok(toStudyDto(session));
    } catch (error) {
      return fail(studyErrorMessage(error));
    }
  });
}

export async function pauseStudyAction(): Promise<ActionResult<StudyDto>> {
  return safeAction("study:pause", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    try {
      return ok(toStudyDto(await pauseStudy(userId)));
    } catch (error) {
      return fail(studyErrorMessage(error));
    }
  });
}

export async function resumeStudyAction(): Promise<ActionResult<StudyDto>> {
  return safeAction("study:resume", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    try {
      return ok(toStudyDto(await resumeStudy(userId)));
    } catch (error) {
      return fail(studyErrorMessage(error));
    }
  });
}

export async function stopStudyAction(input: { notes?: string } = {}): Promise<ActionResult<StudyDto>> {
  return safeAction("study:stop", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    try {
      const result = await stopStudy({ userId, notes: input.notes ?? null });
      revalidatePath("/dashboard");
      revalidatePath("/study/history");
      return ok(toStudyDto(result.session));
    } catch (error) {
      return fail(studyErrorMessage(error));
    }
  });
}

export async function discardStudyAction(): Promise<ActionResult<{ discarded: true }>> {
  return safeAction("study:discard", async () => {
    const userId = await currentUserId();
    if (!userId) return fail("You need to be signed in.");
    await discardStudy(userId, "Discarded by the user from the timer");
    revalidatePath("/dashboard");
    return ok({ discarded: true });
  });
}
