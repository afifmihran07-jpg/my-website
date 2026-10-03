"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity as ActivityIcon, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { formatHoursMinutes, formatShortDate } from "@/lib/format";
import { createActivityAction, updateActivityAction } from "@/server/services/life-actions";
import type { SerializedActivity } from "@/server/services/life-validation";

const RECURRENCES = ["none", "daily", "weekly", "monthly", "custom"] as const;

const emptyForm = {
  title: "",
  kind: "",
  startedAt: "",
  endedAt: "",
  recurrence: "none" as (typeof RECURRENCES)[number],
  notes: "",
};

export function ActivitiesClient({
  activities,
  summary,
  timeZone,
}: {
  activities: SerializedActivity[];
  summary: { kind: string; count: number; minutes: number }[];
  timeZone: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedActivity | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalMinutes = summary.reduce((sum, row) => sum + row.minutes, 0);
  const totalCount = summary.reduce((sum, row) => sum + row.count, 0);

  function openAdd() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setEditing(null);
    setForm({ ...emptyForm, startedAt: now.toISOString().slice(0, 16) });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(activity: SerializedActivity) {
    setEditing(activity);
    setForm({
      title: activity.title,
      kind: activity.kind,
      startedAt: activity.startedAt ? activity.startedAt.slice(0, 16) : "",
      endedAt: activity.endedAt ? activity.endedAt.slice(0, 16) : "",
      recurrence: activity.recurrence as (typeof RECURRENCES)[number],
      notes: activity.notes ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title,
      kind: form.kind,
      startedAt: form.startedAt,
      endedAt: form.endedAt || null,
      recurrence: form.recurrence,
      notes: form.notes,
    };
    const result = editing
      ? await updateActivityAction(editing.id, payload)
      : await createActivityAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function archive(activity: SerializedActivity) {
    setBusy(true);
    const result = await updateActivityAction(activity.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Activities (7d)" value={String(totalCount)} hint="Everything you logged this week" />
        <StatCard label="Time logged" value={formatHoursMinutes(totalMinutes * 60)} hint="Summed from your start and end times" />
        <StatCard label="Kinds tracked" value={String(summary.length)} hint={summary[0] ? `Most frequent: ${summary[0].kind}` : "Nothing yet"} />
        <StatCard label="All time" value={String(activities.length)} hint="Not archived" />
      </div>

      {summary.length > 0 ? (
        <Card>
          <CardHeader title="Last 7 days by kind" subtitle="Counted from the activities you actually logged." />
          <ul className="divide-y divide-border">
            {summary.map((row) => (
              <li key={row.kind} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span className="font-medium capitalize">{row.kind}</span>
                <span className="text-muted-foreground">
                  {row.count} × · {formatHoursMinutes(row.minutes * 60)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Activities"
          subtitle="Exercise, sport, practice, volunteering — anything that is not study or a task."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Log activity
            </Button>
          }
        />
        {activities.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon className="h-8 w-8" />}
            title="No activities logged"
            description="Log what you did and when. Duration is calculated from the two timestamps, never typed in by hand."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Log your first
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((activity) => (
              <li key={activity.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <Badge tone="neutral">{activity.kind}</Badge>
                    {activity.recurrence !== "none" ? <Badge tone="accent">{activity.recurrence}</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.startedAt ? formatShortDate(activity.startedAt, timeZone) : ""}
                    {activity.durationMinutes ? ` · ${formatHoursMinutes(activity.durationMinutes * 60)}` : ""}
                  </p>
                  {activity.notes ? <p className="mt-1 text-xs text-muted-foreground">{activity.notes}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(activity)} aria-label={`Edit ${activity.title}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => archive(activity)} disabled={busy} aria-label={`Archive ${activity.title}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit activity" : "Log an activity"}
        description="Give both times and the duration is worked out for you."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.title.trim() || !form.startedAt}>
              {editing ? "Save changes" : "Log activity"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Morning run" />
          </Field>
          <Field label="Kind" hint="e.g. exercise, sport, practice">
            <Input value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} placeholder="exercise" />
          </Field>
          <Field label="Repeats">
            <Select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value as (typeof RECURRENCES)[number] })}>
              {RECURRENCES.map((value) => (
                <option key={value} value={value}>
                  {value === "none" ? "Does not repeat" : value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Started at" required>
            <Input type="datetime-local" value={form.startedAt} onChange={(event) => setForm({ ...form, startedAt: event.target.value })} />
          </Field>
          <Field label="Ended at" hint="Leave blank if it is still going">
            <Input type="datetime-local" value={form.endedAt} onChange={(event) => setForm({ ...form, endedAt: event.target.value })} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <Label className="mb-0">{label}</Label>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
