import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getRunningStudy, toStudyDto } from "@/server/services/study";

export const dynamic = "force-dynamic";

/**
 * The single source of truth for the running timer.
 * Clients poll this on an interval and derive the on-screen clock from
 * `serverNow`, so a refresh, a background tab or a dead battery never loses
 * the session (§8).
 */
export async function GET() {
  const record = await getSessionUser();
  if (!record) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const session = await getRunningStudy(record.user.id);
  return NextResponse.json({
    session: session ? toStudyDto(session) : null,
    serverNow: new Date().toISOString(),
  });
}
