import { requireUser } from "@/server/auth/session";
import { RemindersClient } from "@/components/reminders/RemindersClient";
import { getEngineStatus, listNotifications, listReminders } from "@/server/services/reminders";
import { runReminderTick } from "@/server/services/reminders";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const user = await requireUser();

  // Catch up on anything that fell due while the tab was closed.
  await runReminderTick().catch((error) => {
    console.error("[afif-os] reminder tick failed:", error instanceof Error ? error.message : error);
  });

  const [status, reminders, notifications] = await Promise.all([
    getEngineStatus(user.id),
    listReminders(user.id, { limit: 100 }),
    listNotifications(user.id, 30),
  ]);

  return (
    <RemindersClient
      timeZone={user.timezone}
      status={status}
      reminders={reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        description: reminder.description,
        status: reminder.status,
        recurrence: reminder.recurrence,
        priority: reminder.priority,
        remindAt: reminder.remindAt.toISOString(),
        attempts: reminder.attempts,
        maxAttempts: reminder.maxAttempts,
        lastError: reminder.lastError,
        deliveredAt: reminder.deliveredAt?.toISOString() ?? null,
        completedAt: reminder.completedAt?.toISOString() ?? null,
        linkedType: reminder.linkedType,
      }))}
      notifications={notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        kind: notification.kind,
        read: notification.readAt !== null,
        createdAt: notification.createdAt.toISOString(),
        actionUrl: notification.actionUrl,
      }))}
    />
  );
}
