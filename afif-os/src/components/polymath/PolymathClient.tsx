"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Link2, Plus, Waypoints } from "lucide-react";

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
import { formatHoursMinutes } from "@/lib/format";
import { STAGE_LABELS, type MasteryStage } from "@/server/services/common-validation";
import {
  createConnectionAction,
  createConceptAction,
  createDomainAction,
  deleteConnectionAction,
  updateConceptAction,
  updateDomainAction,
} from "@/server/services/learning-actions";
import {
  CONNECTABLE_TYPE_LABELS,
  CONCEPT_STATUS_LABELS,
  DOMAIN_CATEGORY_LABELS,
  RELATION_LABELS,
  type SerializedConcept,
  type SerializedConnection,
  type SerializedDomain,
} from "@/server/services/learning-validation";

type Stats = {
  domains: number;
  concepts: number;
  questions: number;
  openQuestions: number;
  notes: number;
  skills: number;
  evidence: number;
  connections: number;
  skillsByStage: { stage: string; count: number }[];
};

type LinkOption = { type: string; id: string; label: string };

const STAGES: MasteryStage[] = ["exposure", "foundation", "working_knowledge", "applied", "advanced"];

const emptyDomain = {
  name: "",
  category: "stem" as SerializedDomain["category"],
  stage: "exposure" as MasteryStage,
  summary: "",
  parentId: "",
};

const emptyConcept = {
  title: "",
  summary: "",
  domainId: "",
  status: "new" as SerializedConcept["status"],
};

export function PolymathClient({
  domains,
  concepts,
  connections,
  stats,
  linkOptions,
}: {
  domains: SerializedDomain[];
  concepts: SerializedConcept[];
  connections: SerializedConnection[];
  stats: Stats;
  linkOptions: LinkOption[];
}) {
  const router = useRouter();
  const [domainOpen, setDomainOpen] = React.useState(false);
  const [conceptOpen, setConceptOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [domainForm, setDomainForm] = React.useState(emptyDomain);
  const [conceptForm, setConceptForm] = React.useState(emptyConcept);
  const [linkForm, setLinkForm] = React.useState({
    fromType: "note",
    fromId: "",
    toType: "concept",
    toId: "",
    relation: "relates_to",
    note: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const optionsFor = (type: string) => linkOptions.filter((option) => option.type === type);

  async function submitDomain() {
    setBusy(true);
    setError(null);
    const result = await createDomainAction({
      name: domainForm.name,
      category: domainForm.category,
      stage: domainForm.stage,
      summary: domainForm.summary,
      parentId: domainForm.parentId || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDomainOpen(false);
    setDomainForm(emptyDomain);
    router.refresh();
  }

  async function submitConcept() {
    setBusy(true);
    setError(null);
    const result = await createConceptAction({
      title: conceptForm.title,
      summary: conceptForm.summary,
      domainId: conceptForm.domainId || null,
      status: conceptForm.status,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConceptOpen(false);
    setConceptForm(emptyConcept);
    router.refresh();
  }

  async function submitLink() {
    setBusy(true);
    setError(null);
    const result = await createConnectionAction({
      fromType: linkForm.fromType,
      fromId: linkForm.fromId,
      toType: linkForm.toType,
      toId: linkForm.toId,
      relation: linkForm.relation,
      note: linkForm.note,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLinkOpen(false);
    setLinkForm({ ...linkForm, fromId: "", toId: "", note: "" });
    router.refresh();
  }

  async function setDomainStage(domain: SerializedDomain, stage: MasteryStage) {
    setBusy(true);
    const result = await updateDomainAction(domain.id, { stage });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function setConceptStatus(concept: SerializedConcept, status: SerializedConcept["status"]) {
    setBusy(true);
    const result = await updateConceptAction(concept.id, { status });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function removeConnection(id: string) {
    setBusy(true);
    const result = await deleteConnectionAction(id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const flat: { domain: SerializedDomain; depth: number }[] = [];
  const walk = (nodes: SerializedDomain[], depth: number) => {
    for (const node of nodes) {
      flat.push({ domain: node, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(domains, 0);

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Domains" value={String(stats.domains)} hint="Areas you are building knowledge in" />
        <StatCard label="Concepts" value={String(stats.concepts)} hint={`${stats.notes} notes · ${stats.skills} skills`} />
        <StatCard label="Open questions" value={String(stats.openQuestions)} hint={`of ${stats.questions} total`} />
        <StatCard label="Connections" value={String(stats.connections)} hint={`${stats.evidence} evidence records`} />
      </div>

      <Card>
        <CardHeader
          title="Knowledge map"
          subtitle="Your domains, what sits inside each one, and how far you have actually got."
          action={
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setConceptOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Concept
              </Button>
              <Button size="sm" onClick={() => setDomainOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Domain
              </Button>
            </div>
          }
        />
        {flat.length === 0 ? (
          <EmptyState
            icon={<Waypoints className="h-8 w-8" />}
            title="No knowledge domains yet"
            description="A domain is an area you want to understand deeply — “Distributed systems”, “Behavioural economics”, “Music theory”. Start broad, add sub-domains as you go."
            action={
              <Button size="sm" onClick={() => setDomainOpen(true)}>
                <Plus className="h-4 w-4" /> Add your first domain
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {flat.map(({ domain, depth }) => (
              <li key={domain.id} className="p-4" style={{ paddingLeft: `${16 + depth * 20}px` }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {depth > 0 ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                      <p className="text-sm font-semibold">{domain.name}</p>
                      <Badge tone="primary">{STAGE_LABELS[domain.stage as MasteryStage]}</Badge>
                      <Badge tone="neutral">{DOMAIN_CATEGORY_LABELS[domain.category as keyof typeof DOMAIN_CATEGORY_LABELS]}</Badge>
                    </div>
                    {domain.summary ? <p className="mt-1 text-xs text-muted-foreground">{domain.summary}</p> : null}
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {domain.bookCount ? <span>{domain.bookCount} books</span> : null}
                      {domain.conceptCount ? <span>{domain.conceptCount} concepts</span> : null}
                      {domain.noteCount ? <span>{domain.noteCount} notes</span> : null}
                      {domain.questionCount ? <span>{domain.questionCount} questions</span> : null}
                      {domain.skillCount ? <span>{domain.skillCount} skills</span> : null}
                      {domain.studySeconds ? <span>{formatHoursMinutes(domain.studySeconds)} studied</span> : null}
                      {domain.readingSeconds ? <span>{formatHoursMinutes(domain.readingSeconds)} reading</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {STAGES.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        disabled={busy}
                        onClick={() => setDomainStage(domain, stage)}
                        className={`rounded-md border px-1.5 py-0.5 text-[10px] transition-colors ${
                          domain.stage === stage
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {STAGE_LABELS[stage].split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Concepts" subtitle="Individual ideas you are working to understand, and how far each has got." />
        {concepts.length === 0 ? (
          <EmptyState title="No concepts yet" description="Add the specific ideas inside a domain — “Consensus”, “Entropy”, “Option pricing”." />
        ) : (
          <ul className="divide-y divide-border">
            {concepts.slice(0, 40).map((concept) => (
              <li key={concept.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{concept.title}</p>
                    <Badge tone={concept.status === "understood" || concept.status === "applied" ? "primary" : "neutral"}>
                      {CONCEPT_STATUS_LABELS[concept.status as keyof typeof CONCEPT_STATUS_LABELS]}
                    </Badge>
                    {concept.domainName ? <Badge tone="accent">{concept.domainName}</Badge> : null}
                    {concept.bookTitle ? <Badge tone="neutral">{concept.bookTitle}</Badge> : null}
                  </div>
                  {concept.summary ? <p className="mt-1 text-xs text-muted-foreground">{concept.summary}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {concept.noteCount} note{concept.noteCount === 1 ? "" : "s"} · {concept.questionCount} question
                    {concept.questionCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Select
                  className="h-8 w-36 text-xs"
                  value={concept.status}
                  disabled={busy}
                  onChange={(event) => setConceptStatus(concept, event.target.value as SerializedConcept["status"])}
                >
                  {Object.entries(CONCEPT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Knowledge graph"
          subtitle="Explicit links between your notes, concepts, books, skills and courses."
          action={
            <Button size="sm" variant="secondary" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-3.5 w-3.5" /> Connect two items
            </Button>
          }
        />
        {connections.length === 0 ? (
          <EmptyState
            title="No connections yet"
            description="A connection says “this note supports that concept” or “this book led to that project”. Those links are what make the system more than separate lists."
          />
        ) : (
          <ul className="divide-y divide-border">
            {connections.slice(0, 60).map((connection) => (
              <li key={connection.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{connection.fromLabel}</span>
                  <span className="mx-1.5 text-muted-foreground">
                    {RELATION_LABELS[connection.relation as keyof typeof RELATION_LABELS] ?? connection.relation}
                  </span>
                  <span className="font-medium">{connection.toLabel}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {CONNECTABLE_TYPE_LABELS[connection.fromType as keyof typeof CONNECTABLE_TYPE_LABELS]} →{" "}
                    {CONNECTABLE_TYPE_LABELS[connection.toType as keyof typeof CONNECTABLE_TYPE_LABELS]}
                  </span>
                  {connection.note ? <p className="mt-0.5 text-[11px] text-muted-foreground">{connection.note}</p> : null}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeConnection(connection.id)} disabled={busy} aria-label="Remove connection">
                  Unlink
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={domainOpen}
        onClose={() => setDomainOpen(false)}
        title="Add a knowledge domain"
        description="Start broad. You can nest sub-domains under it later."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDomainOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitDomain} loading={busy} disabled={!domainForm.name.trim()}>
              Add domain
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={domainForm.name} onChange={(event) => setDomainForm({ ...domainForm, name: event.target.value })} placeholder="Distributed systems" />
          </Field>
          <Field label="Category">
            <Select value={domainForm.category} onChange={(event) => setDomainForm({ ...domainForm, category: event.target.value })}>
              {Object.entries(DOMAIN_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Parent domain">
            <Select value={domainForm.parentId} onChange={(event) => setDomainForm({ ...domainForm, parentId: event.target.value })}>
              <option value="">Top level</option>
              {flat.map(({ domain, depth }) => (
                <option key={domain.id} value={domain.id}>
                  {`${"· ".repeat(depth)}${domain.name}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stage" className="sm:col-span-2">
            <Select value={domainForm.stage} onChange={(event) => setDomainForm({ ...domainForm, stage: event.target.value as MasteryStage })}>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Summary" className="sm:col-span-2">
            <Textarea rows={3} value={domainForm.summary} onChange={(event) => setDomainForm({ ...domainForm, summary: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={conceptOpen}
        onClose={() => setConceptOpen(false)}
        title="Add a concept"
        description="A specific idea inside one of your domains."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConceptOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitConcept} loading={busy} disabled={!conceptForm.title.trim()}>
              Add concept
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Concept" required className="sm:col-span-2">
            <Input value={conceptForm.title} onChange={(event) => setConceptForm({ ...conceptForm, title: event.target.value })} placeholder="Consensus" />
          </Field>
          <Field label="Domain">
            <Select value={conceptForm.domainId} onChange={(event) => setConceptForm({ ...conceptForm, domainId: event.target.value })}>
              <option value="">Not linked</option>
              {flat.map(({ domain, depth }) => (
                <option key={domain.id} value={domain.id}>
                  {`${"· ".repeat(depth)}${domain.name}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={conceptForm.status} onChange={(event) => setConceptForm({ ...conceptForm, status: event.target.value as SerializedConcept["status"] })}>
              {Object.entries(CONCEPT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Summary" className="sm:col-span-2">
            <Textarea rows={3} value={conceptForm.summary} onChange={(event) => setConceptForm({ ...conceptForm, summary: event.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Connect two items"
        description="Say what the relationship actually is — that is the useful part."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitLink} loading={busy} disabled={!linkForm.fromId || !linkForm.toId}>
              <Link2 className="h-4 w-4" /> Create connection
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From — type">
            <Select value={linkForm.fromType} onChange={(event) => setLinkForm({ ...linkForm, fromType: event.target.value, fromId: "" })}>
              {Object.entries(CONNECTABLE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="From — item">
            <Select value={linkForm.fromId} onChange={(event) => setLinkForm({ ...linkForm, fromId: event.target.value })}>
              <option value="">Choose…</option>
              {optionsFor(linkForm.fromType).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To — type">
            <Select value={linkForm.toType} onChange={(event) => setLinkForm({ ...linkForm, toType: event.target.value, toId: "" })}>
              {Object.entries(CONNECTABLE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="To — item">
            <Select value={linkForm.toId} onChange={(event) => setLinkForm({ ...linkForm, toId: event.target.value })}>
              <option value="">Choose…</option>
              {optionsFor(linkForm.toType).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Relationship" className="sm:col-span-2">
            <Select value={linkForm.relation} onChange={(event) => setLinkForm({ ...linkForm, relation: event.target.value })}>
              {Object.entries(RELATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Why" className="sm:col-span-2">
            <Textarea rows={2} value={linkForm.note} onChange={(event) => setLinkForm({ ...linkForm, note: event.target.value })} />
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
