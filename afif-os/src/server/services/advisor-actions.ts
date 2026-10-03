"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import { ADVISOR_QUESTIONS, advisorHistory, askAdvisor, type Advice } from "@/server/services/advisor";

export async function askAdvisorAction(question: string): Promise<ActionResult<Advice>> {
  return safeAction("advisor:ask", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    const allowed = (ADVISOR_QUESTIONS as readonly string[]).includes(question);
    if (!allowed) return fail("That question is not supported yet.");
    const advice = await askAdvisor(record.user.id, question, record.user.timezone);
    revalidatePath("/advisor");
    return ok(advice);
  });
}

export async function advisorHistoryAction(): Promise<ActionResult<Advice[]>> {
  return safeAction("advisor:history", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in.");
    return ok(await advisorHistory(record.user.id));
  });
}
