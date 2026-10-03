import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runReminderTick } from "@/server/services/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Schedulable entry point for the reminder engine.
 *
 * The engine also runs when a signed-in user opens /reminders or /dashboard, but a
 * private app may sit for days without a visit — so this endpoint exists to be hit
 * by a cron job (Vercel Cron, a systemd timer, anything).
 *
 * It is deliberately not public. Without REMINDER_TICK_TOKEN configured it refuses
 * to run rather than becoming an unauthenticated way to mutate reminder state.
 */
function authorized(request: Request): boolean {
  const expected = process.env.REMINDER_TICK_TOKEN;
  if (!expected || expected.length < 16) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.REMINDER_TICK_TOKEN
            ? "Unauthorized"
            : "REMINDER_TICK_TOKEN is not configured, so the engine cannot be scheduled. Set it to at least 16 characters.",
      },
      { status: process.env.REMINDER_TICK_TOKEN ? 401 : 503 },
    );
  }

  try {
    const result = await runReminderTick();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // Report the failure. A reminder engine that swallows its own errors is
    // exactly the "silently pretend delivery" behaviour this app avoids.
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "tick failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: false,
    error: "POST with Authorization: Bearer <REMINDER_TICK_TOKEN>",
  }, { status: 405 });
}
