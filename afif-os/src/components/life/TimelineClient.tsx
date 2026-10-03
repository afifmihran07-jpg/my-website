"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flag, History, Plus, Trash2 } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { formatShortDate } from "@/lib/format";
import {
  createMilestoneAction,
  createTimelineAction,
  deleteMilestoneAction,
  deleteReflectionAction,
  deleteTimelineAction,
  saveReflectionAction,
} from "@/server/services/life-actions";
import { REFLECTION_FIELD_LABELS } from "@/lib/labels";
import {
  type SerializedMilestone,
  type SerializedReflection,
  type SerializedTimelineEvent,} from "@/server/services/life-validation";

const REFLECTION_FIELDS = Object.keys(REFLECTION_FIELD_LABELS) as (keyof typeof REFLECTION_FIELD_LABELS)[];

const KINDS = [
  "academic_award",
  "scholarship",
  "certificate",
  "competition",
  "hackathon",
  "research",
  "conference",
  "project",
  "leadership",
  "presentation",
  "publication",
  "milestone",
  "other",
] as const;

const emptyEvent = {
  title: "",
  description: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  kind: "milestone" as (typeof KINDS)[number],
  importance: "1",
};

const emptyMilestone = {
  title: "",
  description: "",
  kind: "personal",
  achievedOn: new Date().toISOString().slice(0, 10),
};

function monthKey(offset = 0) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset, 1);
  return date.toISOString().slice(0, 10);
}

export function TimelineClient({
  events,
  milestones,
  reflections,
  timeZone,
}: {
  events: SerializedTimelineEvent[];
  milestones: SerializedMilestone[];
  reflections: SerializedReflection[];
  timeZone: string;
}) {
  const router = useRouter();
  const [eventOpen, setEventOpen] = React.useState(false);
  const [milestoneOpen, setMilestoneOpen] = React.useState(false);
  const [eventForm, setEventForm] = React.useState(emptyEvent);
  const [milestoneForm, setMilestoneForm] = React.useState(emptyMilestone);
  const [reflectionPeriod, setReflectionPeriod] = React.useState(reflections[0]?.periodStart ?? monthKey());
  const [reflectionForm, setReflectionForm] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const current = reflections.find((reflection) => reflection.periodStart === reflectionPeriod);

  React.useEffect(() => {
    const found = reflections.find((reflection) => reflection.periodStart === reflectionPeriod);
    const next: Record<string, string> = {};
    for (const field of REFLECTION_FIELDS) next[field] = (found?.[field as keyof SerializedReflection] as string) ?? "";
    setReflectionForm(next);
    setSaved(false);
  }, [reflectionPeriod, reflections]);

  async function submitEvent() {
    setBusy(true);
    setError(null);
    const result = await createTimelineAction({
      title: eventForm.title,
      description: eventForm.description,
      occurredOn: eventForm.occurredOn,
      kind: eventForm.kind,
      importance: eventForm.importance,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEventOpen(false);
    setEventForm(emptyEvent);
    router.refresh();
  }

  async function submitMilestone() {
    setBusy(true);
    setError(null);
    const result = await createMilestoneAction(milestoneForm);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMilestoneOpen(false);
    setMilestoneForm(emptyMilestone);
    router.refresh();
  }

  async function submitReflection() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await saveReflectionAction({ periodStart: reflectionPeriod, ...reflectionForm });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function removeEvent(id: string) {
    setBusy(true);
    const result = await deleteTimelineAction(id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function removeMilestone(id: string) {
    setBusy(true);
    const result = await deleteMilestoneAction(id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function removeReflection(id: string) {
    setBusy(true);
    const result = await deleteReflectionAction(id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const byYear = new Map<string, SerializedTimelineEvent[]>();
  for (const event of events) {
    const year = event.occurredOn.slice(0, 4);
    const bucket = byYear.get(year);
    if (bucket) bucket.push(event);
    else byYear.set(year, [event]);
  }
  const years = [...byYear.keys()].sort((a, b) => Number(b) - Number(a));

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <Card>
        <CardHeader
          title="Timeline"
          subtitle="Everything worth remembering, newest first. Dated by you — never estimated."
          action={
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setMilestoneOpen(true)}>
                <Flag className="h-3.5 w-3.5" /> Milestone
              </Button>
              <Button size="sm" onClick={() => setEventOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Event
              </Button>
            </div>
          }
        />
        {events.length === 0 ? (
          <EmptyState
            icon={<History className="h-8 w-8" />}
            title="Nothing on the timeline yet"
            description="Add the moments that mattered — awards, firsts, launches, decisions."
            action={
              <Button size="sm" onClick={() => setEventOpen(true)}>
                <Plus className="h-4 w-4" /> Add an event
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {years.map((year) => (
              <div key={year} className="p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{year}</p>
                <ol className="space-y-3 border-l border-border pl-4">
                  {(byYear.get(year) ?? []).map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{event.title}</p>
                            <Badge tone="neutral">{event.kind.replace(/_/g, " ")}</Badge>
                            {event.importance > 2 ? <Badge tone="accent">{"★".repeat(event.importance - 2)}</Badge> : null}
                          </div>
                          {event.description ? <p className="mt-1 text-xs text-muted-foreground">{event.description}</p> : null}
                          <p className="mt-1 text-[11px] text-muted-foreground">{formatShortDate(event.occurredOn, timeZone)}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeEvent(event.id)} disabled={busy} aria-label="Delete event">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Milestones" subtitle={`${milestones.length} recorded — the points you consider turning points`} />
        {milestones.length === 0 ? (
          <EmptyState title="No milestones yet" description="A milestone is smaller than an achievement and more personal — “first time I understood recursion”." />
        ) : (
          <ul className="divide-y divide-border">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{milestone.title}</p>
                    <Badge tone="neutral">{milestone.kind}</Badge>
                  </div>
                  {milestone.description ? <p className="mt-1 text-xs text-muted-foreground">{milestone.description}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatShortDate(milestone.achievedOn, timeZone)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeMilestone(milestone.id)} disabled={busy} aria-label="Delete milestone">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Monthly reflection"
          subtitle="Seven questions, answered honestly once a month. One entry per month."
          action={
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setReflectionPeriod(monthKey(-1))}>
                Previous
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setReflectionPeriod(monthKey())}>
                This month
              </Button>
            </div>
          }
        />
        <div className="space-y-3 p-4">
          {saved ? <Alert variant="success">Reflection saved for {reflectionPeriod.slice(0, 7)}.</Alert> : null}
          {current ? (
            <p className="text-[11px] text-muted-foreground">
              Editing the entry for {current.periodStart.slice(0, 7)} — last saved {formatShortDate(current.updatedAt!, timeZone)}.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">No reflection saved for {reflectionPeriod.slice(0, 7)} yet.</p>
          )}

          {REFLECTION_FIELDS.map((field) => (
            <Field key={field} label={REFLECTION_FIELD_LABELS[field] ?? field}>
              <Textarea
                rows={2}
                value={reflectionForm[field] ?? ""}
                onChange={(event) => setReflectionForm({ ...reflectionForm, [field]: event.target.value })}
              />
            </Field>
          ))}

          <div className="flex items-center justify-between">
            {current ? (
              <Button size="sm" variant="ghost" onClick={() => removeReflection(current.id)} disabled={busy}>
                Delete this reflection
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={submitReflection} loading={busy}>
              Save reflection
            </Button>
          </div>
        </div>
      </Card>

      {reflections.length > 1 ? (
        <Card>
          <CardHeader title="Earlier reflections" subtitle="What you wrote in previous months" />
          <ul className="divide-y divide-border">
            {reflections.map((reflection) => (
              <li key={reflection.id} className="px-4 py-3">
                <button
                  type="button"
                  className="text-left text-sm font-medium text-primary hover:underline"
                  onClick={() => setReflectionPeriod(reflection.periodStart)}
                >
                  {reflection.periodStart.slice(0, 7)}
                </button>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {reflection.learned || reflection.accomplished || reflection.proudOf || "No answers written yet."}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Modal
        open={eventOpen}
        onClose={() => setEventOpen(false)}
        title="Add a timeline event"
        description="Something that happened on a specific day and is worth seeing again years later."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEventOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitEvent} loading={busy} disabled={!eventForm.title.trim()}>
              Add event
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={eventForm.occurredOn} onChange={(event) => setEventForm({ ...eventForm, occurredOn: event.target.value })} />
          </Field>
          <Field label="Kind">
            <Select value={eventForm.kind} onChange={(event) => setEventForm({ ...eventForm, kind: event.target.value as (typeof KINDS)[number] })}>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Importance" hint="3 or more gets a star on the timeline">
            <Select value={eventForm.importance} onChange={(event) => setEventForm({ ...eventForm, importance: event.target.value })}>
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        title="Add a milestone"
        description="A personal turning point — smaller and more private than an achievement."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMilestoneOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitMilestone} loading={busy} disabled={!milestoneForm.title.trim()}>
              Add milestone
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={milestoneForm.title} onChange={(event) => setMilestoneForm({ ...milestoneForm, title: event.target.value })} />
          </Field>
          <Field label="Date achieved" required>
            <Input type="date" value={milestoneForm.achievedOn} onChange={(event) => setMilestoneForm({ ...milestoneForm, achievedOn: event.target.value })} />
          </Field>
          <Field label="Kind">
            <Input value={milestoneForm.kind} onChange={(event) => setMilestoneForm({ ...milestoneForm, kind: event.target.value })} placeholder="personal" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={milestoneForm.description} onChange={(event) => setMilestoneForm({ ...milestoneForm, description: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
