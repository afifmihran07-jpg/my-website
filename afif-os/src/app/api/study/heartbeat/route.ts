import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/server/lib/action";
import { getSessionUser } from "@/server/auth/session";
import { heartbeat } from "@/server/services/study";

export const dynamic = "force-dynamic";

/**
 * Proves the timer tab is still alive. Used to cap a session when a client
 * disappears without pressing Stop (closed laptop, killed tab).
 */
export async function POST() {
  if (!(await assertSameOrigin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const record = await getSessionUser();
  if (!record) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await heartbeat(record.user.id);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
