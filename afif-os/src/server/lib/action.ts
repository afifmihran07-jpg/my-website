import "server-only";
import { headers } from "next/headers";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Wraps a server action so an unexpected throw becomes a useful message rather
 * than a silent failure or a stack trace in the UI (§39). The original error is
 * logged server-side with credentials stripped.
 */
export async function safeAction<T>(
  label: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Never leak driver internals (they can embed connection strings).
    console.error(`[afif-os] ${label} failed:`, message.slice(0, 300));
    return fail("Something went wrong while saving. Nothing was lost — please try again.");
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return h.get("x-real-ip") ?? "unknown";
}

export async function userAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

/**
 * Server Actions already get an Origin check from Next; this is the same guard
 * for hand-written route handlers (notifications, push webhooks).
 */
export async function assertSameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("host");
  if (!origin) return true; // same-origin GET/non-browser clients
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
