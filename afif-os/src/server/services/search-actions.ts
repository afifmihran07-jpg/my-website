"use server";

import { getSessionUser } from "@/server/auth/session";
import { fail, ok, safeAction, type ActionResult } from "@/server/lib/action";
import { globalSearch, type SearchHit } from "@/server/services/search";

export async function searchAction(query: string): Promise<ActionResult<SearchHit[]>> {
  return safeAction("search", async () => {
    const record = await getSessionUser();
    if (!record) return fail("You need to be signed in to search.");
    if (query.trim().length < 2) return ok([]);
    return ok(await globalSearch(record.user.id, query, 24));
  });
}
