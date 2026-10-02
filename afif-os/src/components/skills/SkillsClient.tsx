"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, ChevronDown, ExternalLink, Plus, Puzzle, Trash2 } from "lucide-react";

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
import { STAGE_LABELS, type MasteryStage } from "@/server/services/common-validation";
import {
  addEvidenceAction,
  createSkillAction,
  deleteEvidenceAction,
  updateSkillAction,
} from "@/server/services/learning-actions";
import { EVIDENCE_KIND_LABELS } from "@/lib/labels";
import {
  type SerializedSkill,} from "@/server/services/learning-validation";;

type Option = { id: string; name: string };

/** Published thresholds — the same numbers the server uses to make a suggestion. */
const THRESHOLDS: { stage: MasteryStage; count: number }[] = [
  { stage: "exposure", count: 0 },
  { stage: "foundation", count: 1 },
  { stage: "working_knowledge", count: 3 },
  { stage: "applied", count: 5 },
  { stage: "advanced", count: 8 },
];

const emptyForm = {
  name: "",
  category: "",
  description: "",
  stage: "exposure" as MasteryStage,
  domainId: "",
};

const emptyEvidence = {
  kind: "other" as keyof typeof EVIDENCE_KIND_LABELS,
  title: "",
  metricLabel: "",
  metricValue: "",
  url: "",
  occurredAt: new Date().toISOString().slice(0, 10),
};

export function SkillsClient({
  skills,
  domains,
  timeZone,
}: {
  skills: SerializedSkill[];
  domains: Option[];
  timeZone: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedSkill | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [evidenceFor, setEvidenceFor] = React.useState<SerializedSkill | null>(null);
  const [evidenceForm, setEvidenceForm] = React.useState(emptyEvidence);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const byStage = THRESHOLDS.map(({ stage }) => ({
    stage,
    count: skills.filter((skill) => skill.stage === stage).length,
  }));

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(skill: SerializedSkill) {
    setEditing(skill);
    setForm({
      name: skill.name,
      category: skill.category ?? "",
      description: skill.description ?? "",
      stage: skill.stage as MasteryStage,
      domainId: skill.domainId ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  function openEvidence(skill: SerializedSkill) {
    setEvidenceFor(skill);
    setEvidenceForm(emptyEvidence);
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      category: form.category,
      description: form.description,
      stage: form.stage,
      domainId: form.domainId || null,
    };
    const result = editing ? await updateSkillAction(editing.id, payload) : await createSkillAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function submitEvidence() {
    if (!evidenceFor) return;
    setBusy(true);
    setError(null);
    const result = await addEvidenceAction({
      skillId: evidenceFor.id,
      kind: evidenceForm.kind,
      title: evidenceForm.title,
      metricLabel: evidenceForm.metricLabel,
      metricValue: evidenceForm.metricValue || null,
      url: evidenceForm.url,
      occurredAt: evidenceForm.occurredAt,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEvidenceFor(null);
    router.refresh();
  }

  async function removeEvidence(skillId: string, evidenceId: string) {
    setBusy(true);
    const result = await deleteEvidenceAction(skillId, evidenceId);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function setStage(skill: SerializedSkill, stage: MasteryStage) {
    setBusy(true);
    const result = await updateSkillAction(skill.id, { stage });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function archive(skill: SerializedSkill) {
    setBusy(true);
    const result = await updateSkillAction(skill.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && !formOpen && !evidenceFor ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <Alert variant="info" title="Stages, not percentages">
        A skill is described by a stage and the evidence behind it. There is no “Physics 73%” here — a number like
        that would be invented. The suggestion shown next to a skill comes from how many evidence rows it has,
        using the thresholds listed below, and it never changes your choice automatically.
      </Alert>

      <Card>
        <CardHeader
          title="Mastery stages"
          subtitle="How many of your skills sit at each stage right now"
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add skill
            </Button>
          }
        />
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          {byStage.map(({ stage, count }) => (
            <div key={stage} className="rounded-md border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{STAGE_LABELS[stage]}</p>
              <p className="mt-1 text-xl font-semibold">{count}</p>
              <p className="text-[10px] text-muted-foreground">
                {THRESHOLDS.find((item) => item.stage === stage)?.count ?? 0}+ evidence
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Skills" subtitle={`${skills.length} tracked · ${skills.reduce((sum, skill) => sum + skill.evidenceCount, 0)} evidence records`} />
        {skills.length === 0 ? (
          <EmptyState
            icon={<Puzzle className="h-8 w-8" />}
            title="No skills tracked"
            description="Add a skill, then attach evidence: a course, a book, a project, a competition result, a repository."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add your first skill
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {skills.map((skill) => (
              <li key={skill.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="truncate text-sm font-semibold hover:underline"
                        onClick={() => setExpanded(expanded === skill.id ? null : skill.id)}
                      >
                        {skill.name}
                      </button>
                      <Badge tone="primary">{STAGE_LABELS[skill.stage as MasteryStage]}</Badge>
                      {skill.suggestedStage !== skill.stage ? (
                        <Badge tone="neutral" >Evidence suggests {STAGE_LABELS[skill.suggestedStage as MasteryStage]}</Badge>
                      ) : null}
                      {skill.category ? <Badge tone="neutral">{skill.category}</Badge> : null}
                      {skill.domainName ? <Badge tone="accent">{skill.domainName}</Badge> : null}
                    </div>
                    {skill.description ? <p className="mt-1 text-xs text-muted-foreground">{skill.description}</p> : null}
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {skill.evidenceCount} evidence record{skill.evidenceCount === 1 ? "" : "s"}
                      {skill.latestEvidenceAt ? ` · latest ${formatShortDate(skill.latestEvidenceAt, timeZone)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => openEvidence(skill)}>
                      <Plus className="h-3.5 w-3.5" /> Evidence
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(skill)} aria-label={`Edit ${skill.name}`}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(skill)} disabled={busy} aria-label={`Archive ${skill.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Label className="mb-0 mr-1">Stage</Label>
                  {THRESHOLDS.map(({ stage }) => (
                    <button
                      key={stage}
                      type="button"
                      disabled={busy}
                      onClick={() => setStage(skill, stage)}
                      className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                        skill.stage === stage
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {STAGE_LABELS[stage]}
                    </button>
                  ))}
                </div>

                {expanded === skill.id ? (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Evidence</p>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    {skill.evidence.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No evidence yet. Attach a course, book, project, competition or repository.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {skill.evidence.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-medium">{item.title}</p>
                              <p className="text-muted-foreground">
                                {EVIDENCE_KIND_LABELS[item.kind as keyof typeof EVIDENCE_KIND_LABELS]}
                                {item.metricLabel ? ` · ${item.metricLabel}: ${item.metricValue ?? "—"}` : ""}
                                {item.occurredAt ? ` · ${formatShortDate(item.occurredAt, timeZone)}` : ""}
                              </p>
                              {item.url ? (
                                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={item.url} target="_blank" rel="noreferrer">
                                  <ExternalLink className="h-3 w-3" /> Link
                                </a>
                              ) : null}
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => removeEvidence(skill.id, item.id)} disabled={busy} aria-label="Remove evidence">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit skill" : "Add a skill"}
        description="Set the stage yourself — evidence is what makes it defensible."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.name.trim()}>
              {editing ? "Save changes" : "Add skill"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Distributed systems" />
          </Field>
          <Field label="Category">
            <Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Engineering" />
          </Field>
          <Field label="Knowledge domain">
            <Select value={form.domainId} onChange={(event) => setForm({ ...form, domainId: event.target.value })}>
              <option value="">Not linked</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stage" className="sm:col-span-2">
            <Select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as MasteryStage })}>
              {THRESHOLDS.map(({ stage }) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(evidenceFor)}
        onClose={() => setEvidenceFor(null)}
        title={evidenceFor ? `Add evidence — ${evidenceFor.name}` : "Add evidence"}
        description="Anything real: a course you passed, a book you finished, a project you shipped, a result you got."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEvidenceFor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitEvidence} loading={busy} disabled={!evidenceForm.title.trim()}>
              <Award className="h-4 w-4" /> Add evidence
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What is the evidence?" required className="sm:col-span-2">
            <Input value={evidenceForm.title} onChange={(event) => setEvidenceForm({ ...evidenceForm, title: event.target.value })} placeholder="Built a replicated key-value store" />
          </Field>
          <Field label="Kind">
            <Select value={evidenceForm.kind} onChange={(event) => setEvidenceForm({ ...evidenceForm, kind: event.target.value as keyof typeof EVIDENCE_KIND_LABELS })}>
              {Object.entries(EVIDENCE_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={evidenceForm.occurredAt} onChange={(event) => setEvidenceForm({ ...evidenceForm, occurredAt: event.target.value })} />
          </Field>
          <Field label="Metric label" hint="Optional — e.g. “problems solved”">
            <Input value={evidenceForm.metricLabel} onChange={(event) => setEvidenceForm({ ...evidenceForm, metricLabel: event.target.value })} placeholder="problems solved" />
          </Field>
          <Field label="Metric value">
            <Input type="number" value={evidenceForm.metricValue} onChange={(event) => setEvidenceForm({ ...evidenceForm, metricValue: event.target.value })} placeholder="120" />
          </Field>
          <Field label="Link" className="sm:col-span-2">
            <Input value={evidenceForm.url} onChange={(event) => setEvidenceForm({ ...evidenceForm, url: event.target.value })} placeholder="https://…" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
