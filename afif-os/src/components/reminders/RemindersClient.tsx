"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Check, RefreshCw, Trash2 } from "lucide-react";
import {
  cancelReminderAction,
  completeReminderAction,
  createReminderAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  runReminderTickAction,
  setNotificationPermissionAction,
} from "@/server/services/reminders-actions";
import type { EngineStatus } from "@/server/services/reminders";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

type ReminderRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  recurrence: string;
  priority: string;
  remindAt: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  linkedType: string;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  read: boolean;
  createdAt: string;
  actionUrl: string | null;
};

const STATUS_TONE: Record<string, "neutral" | "primary" | "accent" | "warning" | "danger"> = {
  scheduled: "neutral",
  queued: "primary",
  sent: "primary",
  delivered: "accent",
  completed: "accent",
  missed: "danger",
  failed: "danger",
  cancelled: "neutral",
};

export function RemindersClient({
  timeZone,
  status,
  reminders,
  notifications,
}: {
  timeZone: string;
  status: EngineStatus;
  reminders: ReminderRow[];
  notifications: NotificationRow[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({ title: "", date: "", time: "", recurrence: "none", priority: "medium" });
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tickResult, setTickResult] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("create");
    setError(null);
    setNotice(null);
    const result = await createReminderAction(form);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(
      result.data.duplicated
        ? "An identical reminder already exists — nothing was duplicated."
        : `Reminder set for ${new Date(result.data.remindAt).toLocaleString(undefined, { timeZone })}.`,
    );
    setForm((f) => ({ ...f, title: "" }));
    router.refresh();
  };

  const act = async (name: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setPending(name);
    setError(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) setError(result.error ?? "Something went wrong.");
    router.refresh();
  };

  const requestPermission = async () => {
    setPending("permission");
    setError(null);
    let next: string = "unsupported";
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        next = await Notification.requestPermission();
      } catch {
        next = "denied";
      }
    }
    await setNotificationPermissionAction(next as "granted" | "denied" | "default" | "unsupported");
    setPending(null);
    router.refresh();
  };

  const runTick = async () => {
    setPending("tick");
    const result = await runReminderTickAction();
    setPending(null);
    if (result.ok) {
      const { scanned, sent, failed, missed, rescheduled } = result.data;
      setTickResult(`Engine run: ${scanned} due · ${sent} sent · ${rescheduled} rescheduled · ${missed} missed · ${failed} failed.`);
    } else {
      setError(result.error);
    }
    router.refresh();
  };

  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="space-y-4">
      {status.browserPermission !== "granted" ? (
        <Alert variant="warning" title="Browser notifications are not enabled">
          Reminders will still be recorded and shown here, but they cannot pop up outside this tab.
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={requestPermission} loading={pending === "permission"}>
              <Bell className="h-3.5 w-3.5" />
              Enable browser notifications
            </Button>
          </div>
        </Alert>
      ) : (
        <Alert variant="success" title="Browser notifications are enabled">
          In-app notifications are always recorded, so nothing is ever silently dropped.
        </Alert>
      )}

      {status.warnings.length > 0 ? (
        <Alert variant="info" title="Delivery status">
          <ul className="list-disc space-y-0.5 pl-4">
            {status.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Stat label="Scheduled" value={status.scheduled} />
        <Stat label="Queued" value={status.queued} />
        <Stat label="Sent" value={status.sent} />
        <Stat label="Failed" value={status.failed} tone={status.failed > 0 ? "danger" : undefined} />
        <Stat label="Missed" value={status.missed} tone={status.missed > 0 ? "warning" : undefined} />
        <Stat label="Completed" value={status.completed} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="New reminder"
            subtitle={`Times are interpreted in ${timeZone}`}
            icon={<Bell className="h-4 w-4" />}
          />
          <form onSubmit={submit} className="space-y-3 px-4 py-3">
            {error ? <Alert variant="error">{error}</Alert> : null}
            {notice ? <Alert variant="success">{notice}</Alert> : null}
            <Field label="Title" required>
              <Input
                value={form.title}
                onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
                placeholder="Submit scholarship application"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <Input type="date" value={form.date} onChange={(event) => setForm((f) => ({ ...f, date: event.target.value }))} />
              </Field>
              <Field label="Time" required>
                <Input type="time" value={form.time} onChange={(event) => setForm((f) => ({ ...f, time: event.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Repeat">
                <Select value={form.recurrence} onChange={(event) => setForm((f) => ({ ...f, recurrence: event.target.value }))}>
                  <option value="none">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={form.priority} onChange={(event) => setForm((f) => ({ ...f, priority: event.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>
            </div>
            <Button type="submit" full loading={pending === "create"} disabled={!form.title || !form.date || !form.time}>
              Schedule reminder
            </Button>
            <Button type="button" variant="outline" full onClick={runTick} loading={pending === "tick"}>
              <RefreshCw className="h-3.5 w-3.5" />
              Run the engine now
            </Button>
            {tickResult ? <p className="text-[11px] text-muted-foreground">{tickResult}</p> : null}
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Inbox"
            subtitle={`${unread.length} unread`}
            icon={<BellOff className="h-4 w-4" />}
            action={
              unread.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={() => act("read-all", markAllNotificationsReadAction)}>
                  Mark all read
                </Button>
              ) : null
            }
          />
          {notifications.length === 0 ? (
            <EmptyState title="No notifications yet" description="Delivered reminders appear here." />
          ) : (
            <ul className="scrollbar-thin max-h-[420px] divide-y divide-border overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id} className={cn("px-4 py-2.5", !notification.read && "bg-primary/5")}>
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", notification.read ? "bg-border" : "bg-primary")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{notification.title}</p>
                      {notification.body ? <p className="mt-0.5 text-[11px] text-muted-foreground">{notification.body}</p> : null}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{relativeTime(new Date(notification.createdAt))}</p>
                    </div>
                    {!notification.read ? (
                      <button
                        onClick={() => act(`read-${notification.id}`, () => markNotificationReadAction(notification.id))}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Mark "${notification.title}" read`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="All reminders"
          subtitle="Lifecycle: scheduled → queued → sent → delivered → completed"
          action={
            status.nextDueAt ? (
              <span className="text-[11px] text-muted-foreground">
                next due {relativeTime(new Date(status.nextDueAt))}
              </span>
            ) : null
          }
        />
        {reminders.length === 0 ? (
          <EmptyState title="No reminders yet" description="Schedule one above, or create a task with a deadline." />
        ) : (
          <ul className="divide-y divide-border">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">{reminder.title}</p>
                    <Badge tone={STATUS_TONE[reminder.status] ?? "neutral"}>{reminder.status}</Badge>
                    {reminder.recurrence !== "none" ? <Badge tone="primary">{reminder.recurrence}</Badge> : null}
                  </div>
                  {reminder.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{reminder.description}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(reminder.remindAt).toLocaleString(undefined, { timeZone })} · attempt{" "}
                    {reminder.attempts}/{reminder.maxAttempts}
                    {reminder.deliveredAt ? ` · delivered ${relativeTime(new Date(reminder.deliveredAt))}` : ""}
                  </p>
                  {reminder.lastError ? (
                    <p className="mt-1 text-[11px] text-danger">{reminder.lastError}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {reminder.status !== "completed" && reminder.status !== "cancelled" ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => act(`done-${reminder.id}`, () => completeReminderAction(reminder.id))} loading={pending === `done-${reminder.id}`}>
                        <Check className="h-3.5 w-3.5" />
                        Done
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => act(`cancel-${reminder.id}`, () => cancelReminderAction(reminder.id))} loading={pending === `cancel-${reminder.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | "warning" }) {
  return (
    <Card className="px-3 py-2.5">
      <p className={cn("tabular text-lg font-semibold", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </Card>
  );
}
