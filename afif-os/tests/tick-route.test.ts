import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

import { GET, POST } from "@/app/api/tick/route";
import { db } from "@/server/db";
import { notifications, reminders, type User } from "@/server/db/schema";
import { createReminder } from "@/server/services/reminders";
import { TEST_TZ, cleanupUser, makeUser } from "./helpers";

/**
 * The cron endpoint is the only way the reminder engine runs when nobody has the
 * app open, so it has to be both usable and not silently public.
 */

const TOKEN = "tick-test-secret-0123456789";
let user: User;
let previous: string | undefined;

const post = (headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/tick", { method: "POST", headers }));

beforeAll(async () => {
  user = await makeUser("tick");
});

afterAll(async () => {
  await cleanupUser(user.id);
});

beforeEach(() => {
  previous = process.env.REMINDER_TICK_TOKEN;
});

afterEach(() => {
  if (previous === undefined) delete process.env.REMINDER_TICK_TOKEN;
  else process.env.REMINDER_TICK_TOKEN = previous;
});

describe("POST /api/tick", () => {
  it("refuses to run when no token is configured", async () => {
    delete process.env.REMINDER_TICK_TOKEN;

    const res = await post({ authorization: `Bearer ${TOKEN}` });
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/REMINDER_TICK_TOKEN is not configured/);
  });

  it("rejects a missing bearer token", async () => {
    process.env.REMINDER_TICK_TOKEN = TOKEN;

    const res = await post();

    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
  });

  it("rejects a wrong bearer token", async () => {
    process.env.REMINDER_TICK_TOKEN = TOKEN;

    const res = await post({ authorization: "Bearer not-the-token" });

    expect(res.status).toBe(401);
  });

  it("rejects a non-bearer authorization scheme", async () => {
    process.env.REMINDER_TICK_TOKEN = TOKEN;

    const res = await post({ authorization: `Basic ${TOKEN}` });

    expect(res.status).toBe(401);
  });

  it("runs the engine and actually delivers a due reminder", async () => {
    process.env.REMINDER_TICK_TOKEN = TOKEN;

    const { reminder } = await createReminder({
      userId: user.id,
      title: "Reminder reached through the cron endpoint",
      remindAt: new Date(Date.now() - 2000),
      timeZone: TEST_TZ,
    });
    expect(reminder.status).toBe("scheduled");

    const res = await post({ authorization: `Bearer ${TOKEN}` });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.scanned).toBe("number");
    expect(body.ranAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const [row] = await db
      .select({ status: reminders.status })
      .from(reminders)
      .where(eq(reminders.id, reminder.id));
    expect(row?.status).toBe("sent");

    const notes = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.reminderId, reminder.id)));
    expect(notes).toHaveLength(1);
  });

  it("does not expose a GET handler", async () => {
    const res = await GET();

    expect(res.status).toBe(405);
    expect((await res.json()).ok).toBe(false);
  });
});
