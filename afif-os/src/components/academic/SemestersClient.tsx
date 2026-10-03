"use client";

import * as React from "react";
import { CalendarDays, Pencil, Star, Trash2 } from "lucide-react";

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
import { createSemesterAction, setActiveSemesterAction, updateSemesterAction } from "@/server/services/academic-actions";
import { SEMESTER_STATUSES } from "@/lib/labels";

const STATUS_LABELS: Record<string, string> = { planned: "Planned", active: "Active", completed: "Completed" };
const STATUS_TONES: Record<string, "neutral" | "primary" | "accent" | "warning" | "danger"> = {
  planned: "neutral",
  active: "accent",
  completed: "primary",
};

type Row = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  targetCgpa: number | null;
  notes: string | null;
  courseCount: number;
  assessmentCount: number;
  cgpa: number | null;
  creditsCounted: number;
};

export function SemestersClient({ rows }: { rows: Row[] }) {
  const [busy, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [draft, setDraft] = React.useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "planned",
    targetCgpa: "",
    notes: "",
  });

  function openCreate() {
    setDraft({ name: "", startDate: "", endDate: "", status: "planned", targetCgpa: "", notes: "" });
    setCreating(true);
  }

  function openEdit(row: Row) {
    setDraft({
      name: row.name,
      startDate: row.startDate ?? "",
      endDate: row.endDate ?? "",
      targetCgpa: row.targetCgpa === null ? "" : String(row.targetCgpa),
      notes: row.notes ?? "",
      status: row.status,
    });
    setEditing(row);
  }

  async function run(fn: () => Promise<unknown>, close: () => void) {
    setError(null);
    const result = (await fn()) as { ok: boolean; error?: string };
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    close();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Semesters</h1>
          <p className="text-sm text-muted-foreground">
            One semester is active at a time. CGPA is computed from recorded grades, never stored.
          </p>
        </div>
        <Button onClick={openCreate}>New semester</Button>
      </div>

      {error ? <Alert variant="error" title={error} /> : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="No semesters yet"
            description="Add your first semester, then attach courses and assessments to it."
            action={<Button onClick={openCreate}>New semester</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader
                title={row.name}
                subtitle={
                  [row.startDate, row.endDate].filter(Boolean).join(" → ") || "No dates set"
                }
                icon={<CalendarDays className="h-4 w-4" />}
                action={<Badge tone={STATUS_TONES[row.status] ?? "neutral"}>{STATUS_LABELS[row.status] ?? row.status}</Badge>}
              />
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                <Metric label="CGPA" value={row.cgpa === null ? "—" : row.cgpa.toFixed(2)} />
                <Metric label="Credits" value={String(row.creditsCounted)} />
                <Metric
                  label="Target"
                  value={row.targetCgpa === null ? "—" : row.targetCgpa.toFixed(2)}
                />
              </div>
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                {row.courseCount} course{row.courseCount === 1 ? "" : "s"} · {row.assessmentCount} assessment
                {row.assessmentCount === 1 ? "" : "s"}
              </p>
              {row.notes ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{row.notes}</p> : null}
              <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                {row.status !== "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => start(() => run(() => setActiveSemesterAction(row.id), () => undefined))}
                  >
                    <Star className="mr-1.5 h-3.5 w-3.5" />
                    Make active
                  </Button>
                ) : (
                  <Badge tone="accent">Current semester</Badge>
                )}
                <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                {row.status !== "completed" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => start(() => run(() => updateSemesterAction(row.id, { status: "completed" }), () => undefined))}
                  >
                    Mark completed
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New semester"}
        description={editing ? "Changes apply to the courses and grades already attached." : "You can attach courses after creating it."}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            {editing ? (
              <>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => start(() => run(() => updateSemesterAction(editing.id, { archived: true }), () => setEditing(null)))}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Archive
                </Button>
                <Button disabled={busy} onClick={() => start(() => run(() => updateSemesterAction(editing.id, draft), () => setEditing(null)))}>
                  Save
                </Button>
              </>
            ) : (
              <Button disabled={busy} onClick={() => start(() => run(() => createSemesterAction(draft), () => setCreating(false)))}>
                Create semester
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Spring 2026" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <Input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} />
            </Field>
            <Field label="End date">
              <Input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Target CGPA" hint="Optional. Used by the target calculator, never as a prediction.">
            <Input
              type="number"
              step="0.01"
              min="0"
              max="4"
              value={draft.targetCgpa}
              onChange={(e) => setDraft({ ...draft, targetCgpa: e.target.value })}
              placeholder="3.75"
            />
          </Field>
          <Field label="Notes">
            <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
          {editing ? (
            <Field label="Status" hint="Only one semester can be active; activating another demotes this one.">
              <Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                {SEMESTER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <Label className="mb-0 text-[10px] uppercase tracking-wide">{label}</Label>
      <p className="tabular mt-0.5 text-lg font-semibold">{value}</p>
    </div>
  );
}
