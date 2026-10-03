"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Pencil, Plus, Rocket, Trash2 } from "lucide-react";

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
import { formatShortDate } from "@/lib/format";
import { createOpportunityAction, updateOpportunityAction } from "@/server/services/opportunities-actions";
import { OPPORTUNITY_STATUS_LABELS, OPPORTUNITY_STATUS_TONES, OPPORTUNITY_TYPE_LABELS } from "@/lib/labels";
import {
  type SerializedOpportunity,} from "@/server/services/opportunities-validation";;

type Stats = {
  total: number;
  applied: number;
  accepted: number;
  upcomingDeadlines: number;
  missed: number;
  byType: { type: string; count: number }[];
};

const URGENCY_TONES = {
  none: "neutral",
  soon: "warning",
  critical: "danger",
  passed: "danger",
} as const;

const URGENCY_LABELS: Record<SerializedOpportunity["urgency"], string> = {
  none: "",
  soon: "Closing soon",
  critical: "Under a week",
  passed: "Deadline passed",
};

const emptyForm = {
  name: "",
  type: "competition" as SerializedOpportunity["type"],
  source: "",
  deadline: "",
  registrationUrl: "",
  description: "",
  whyInterested: "",
  status: "interested" as SerializedOpportunity["status"],
  reminderEnabled: false,
  skills: "",
  domains: "",
};

export function OpportunitiesClient({
  opportunities,
  stats,
  timeZone,
}: {
  opportunities: SerializedOpportunity[];
  stats: Stats;
  timeZone: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  const [filter, setFilter] = React.useState<string>(typeParam && typeParam !== "all" ? typeParam : "all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedOpportunity | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visible = filter === "all" ? opportunities : opportunities.filter((item) => item.type === filter);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm, type: filter === "all" ? "competition" : (filter as SerializedOpportunity["type"]) });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(item: SerializedOpportunity) {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      source: item.source ?? "",
      deadline: item.deadline ?? "",
      registrationUrl: item.registrationUrl ?? "",
      description: item.description ?? "",
      whyInterested: item.whyInterested ?? "",
      status: item.status,
      reminderEnabled: item.reminderEnabled,
      skills: item.skills.join(", "),
      domains: item.domains.join(", "),
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      type: form.type,
      source: form.source,
      deadline: form.deadline || null,
      registrationUrl: form.registrationUrl,
      description: form.description,
      whyInterested: form.whyInterested,
      status: form.status,
      reminderEnabled: form.reminderEnabled,
      skills: form.skills,
      domains: form.domains,
    };
    const result = editing
      ? await updateOpportunityAction(editing.id, payload)
      : await createOpportunityAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function setStatus(item: SerializedOpportunity, status: SerializedOpportunity["status"]) {
    setBusy(true);
    const result = await updateOpportunityAction(item.id, { status });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function archive(item: SerializedOpportunity) {
    setBusy(true);
    const result = await updateOpportunityAction(item.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && !formOpen ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tracked" value={String(stats.total)} hint={`${stats.byType.length} categories`} />
        <StatCard label="Applied" value={String(stats.applied)} hint={`${stats.accepted} accepted`} />
        <StatCard label="Upcoming deadlines" value={String(stats.upcomingDeadlines)} hint="Still open to you" />
        <StatCard label="Missed deadlines" value={String(stats.missed)} hint="Passed while unresolved" />
      </div>

      <Card>
        <CardHeader
          title="Opportunities"
          subtitle="Competitions, scholarships, internships and everything else worth applying to — sorted by deadline."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add opportunity
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-border px-4 pb-3">
          {[{ key: "all", label: "All" }, ...Object.entries(OPPORTUNITY_TYPE_LABELS).map(([key, label]) => ({ key, label }))].map(
            (item) => {
              const count =
                item.key === "all" ? opportunities.length : opportunities.filter((o) => o.type === item.key).length;
              if (item.key !== "all" && count === 0) return null;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    filter === item.key
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {item.label} <span className="opacity-60">{count}</span>
                </button>
              );
            },
          )}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<Rocket className="h-8 w-8" />}
            title={opportunities.length === 0 ? "No opportunities tracked" : "Nothing in this category"}
            description="Save what you find here so deadlines stop living in browser tabs. Turn on reminders and the engine will warn you before it closes."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add one
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <Badge tone="neutral">{OPPORTUNITY_TYPE_LABELS[item.type]}</Badge>
                      <Badge tone={OPPORTUNITY_STATUS_TONES[item.status]}>{OPPORTUNITY_STATUS_LABELS[item.status]}</Badge>
                      {item.urgency !== "none" ? <Badge tone={URGENCY_TONES[item.urgency]}>{URGENCY_LABELS[item.urgency]}</Badge> : null}
                    </div>
                    {item.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p> : null}
                    {item.whyInterested ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">Why: {item.whyInterested}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {item.source ? <span>{item.source}</span> : null}
                      {item.deadline ? (
                        <span className={item.urgency === "critical" || item.urgency === "passed" ? "text-danger" : ""}>
                          Deadline {formatShortDate(item.deadline, timeZone)}
                          {item.daysLeft !== null ? (item.daysLeft < 0 ? ` · ${Math.abs(item.daysLeft)}d ago` : ` · ${item.daysLeft}d left`) : ""}
                        </span>
                      ) : null}
                      {item.skills.length ? <span>Skills: {item.skills.join(", ")}</span> : null}
                      {item.registrationUrl ? (
                        <a className="inline-flex items-center gap-1 text-primary hover:underline" href={item.registrationUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3 w-3" /> Apply
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {item.status === "interested" ? (
                      <Button size="sm" variant="secondary" onClick={() => setStatus(item, "applied")} disabled={busy}>
                        Mark applied
                      </Button>
                    ) : null}
                    {item.status === "applied" ? (
                      <>
                        <Button size="sm" variant="success" onClick={() => setStatus(item, "accepted")} disabled={busy}>
                          Accepted
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setStatus(item, "rejected")} disabled={busy}>
                          Rejected
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(item)} disabled={busy} aria-label={`Archive ${item.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit opportunity" : "Add an opportunity"}
        description="Turn on the deadline reminder and it enters the reminder engine at 09:00 on the day."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.name.trim()}>
              {editing ? "Save changes" : "Add opportunity"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Google Summer of Code" />
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SerializedOpportunity["type"] })}>
              {Object.entries(OPPORTUNITY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label.replace(/s$/, "")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SerializedOpportunity["status"] })}>
              {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Deadline">
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          <Field label="Where you found it">
            <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Professor / LinkedIn / newsletter" />
          </Field>
          <Field label="Registration URL" className="sm:col-span-2">
            <Input value={form.registrationUrl} onChange={(e) => setForm({ ...form, registrationUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Why you are interested" className="sm:col-span-2" hint="Worth writing down before the deadline pressure starts">
            <Textarea rows={2} value={form.whyInterested} onChange={(e) => setForm({ ...form, whyInterested: e.target.value })} />
          </Field>
          <Field label="Relevant skills" hint="Comma separated">
            <Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="Python, systems design" />
          </Field>
          <Field label="Knowledge domains" hint="Comma separated">
            <Input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="Distributed systems" />
          </Field>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              checked={form.reminderEnabled}
              onChange={(e) => setForm({ ...form, reminderEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border bg-background"
            />
            Remind me at 09:00 on the deadline day
          </label>
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
