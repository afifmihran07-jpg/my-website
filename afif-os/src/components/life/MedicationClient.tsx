"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Pill, Plus, SkipForward } from "lucide-react";

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
import { createMedicationAction, logDoseAction, updateMedicationAction } from "@/server/services/life-actions";
import type { SerializedMedication } from "@/server/services/life-validation";

type DoseDue = {
  medicationId: string;
  name: string;
  dose: string | null;
  time: string;
  scheduledAt: string;
  status: "pending" | "taken" | "skipped" | "missed";
};

const emptyForm = {
  name: "",
  dose: "",
  times: "",
  schedule: "",
  startDate: "",
  endDate: "",
  notes: "",
  active: true,
};

export function MedicationClient({
  medications,
  doses,
  adherence,
  timeZone,
}: {
  medications: SerializedMedication[];
  doses: DoseDue[];
  adherence: { days: number; total: number; taken: number; skipped: number; missed: number; pending: number };
  timeZone: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedMedication | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const pending = doses.filter((dose) => dose.status === "pending").length;

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(medication: SerializedMedication) {
    setEditing(medication);
    setForm({
      name: medication.name,
      dose: medication.dose ?? "",
      times: medication.times.join(", "),
      schedule: medication.schedule ?? "",
      startDate: medication.startDate ?? "",
      endDate: medication.endDate ?? "",
      notes: medication.notes ?? "",
      active: medication.active,
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      dose: form.dose,
      times: form.times,
      schedule: form.schedule,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      notes: form.notes,
      active: form.active,
    };
    const result = editing
      ? await updateMedicationAction(editing.id, payload)
      : await createMedicationAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function markDose(dose: DoseDue, status: "taken" | "skipped") {
    setBusy(true);
    setError(null);
    const result = await logDoseAction({
      medicationId: dose.medicationId,
      scheduledAt: dose.scheduledAt,
      status,
    });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function toggleActive(medication: SerializedMedication) {
    setBusy(true);
    const result = await updateMedicationAction(medication.id, { active: !medication.active });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <Alert variant="warning" title="Tracking only">
        This records whether you took what you were already prescribed. It does not recommend, adjust or replace any
        dose — only your doctor does that.
      </Alert>

      {error ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Due today" value={String(doses.length)} hint={`${pending} still pending`} />
        <StatCard label="Active medications" value={String(medications.filter((item) => item.active).length)} hint={`${medications.length} total`} />
        <StatCard label={`Taken (${adherence.days}d)`} value={String(adherence.taken)} hint={`${adherence.skipped} skipped · ${adherence.missed} missed`} />
        <StatCard label="Logged doses" value={String(adherence.total)} hint={`Across the last ${adherence.days} days`} />
      </div>

      <Card>
        <CardHeader
          title="Today's schedule"
          subtitle="Built from the times you entered. Tap as you take each one."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add medication
            </Button>
          }
        />
        {doses.length === 0 ? (
          <EmptyState
            icon={<Pill className="h-8 w-8" />}
            title={medications.length === 0 ? "No medications tracked" : "Nothing scheduled today"}
            description="Add a medication with the times of day it is taken, and the daily schedule appears here."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Add medication
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {doses.map((dose) => (
              <li key={`${dose.medicationId}-${dose.time}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {dose.name}
                    {dose.dose ? <span className="text-muted-foreground"> · {dose.dose}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">Scheduled {dose.time}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {dose.status === "pending" ? (
                    <>
                      <Button size="sm" variant="success" onClick={() => markDose(dose, "taken")} disabled={busy}>
                        <Check className="h-3.5 w-3.5" /> Taken
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => markDose(dose, "skipped")} disabled={busy}>
                        <SkipForward className="h-3.5 w-3.5" /> Skip
                      </Button>
                    </>
                  ) : (
                    <Badge tone={dose.status === "taken" ? "primary" : dose.status === "skipped" ? "warning" : "danger"}>
                      {dose.status === "taken" ? "Taken" : dose.status === "skipped" ? "Skipped" : "Missed"}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Medications" subtitle="What you are tracking, and the times you entered for each." />
        {medications.length === 0 ? (
          <EmptyState title="Nothing tracked yet" />
        ) : (
          <ul className="divide-y divide-border">
            {medications.map((medication) => (
              <li key={medication.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{medication.name}</p>
                    {medication.dose ? <Badge tone="neutral">{medication.dose}</Badge> : null}
                    {medication.active ? <Badge tone="accent">Active</Badge> : <Badge tone="neutral">Paused</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {medication.times.length ? medication.times.join(" · ") : "No times set"}
                    {medication.schedule ? ` · ${medication.schedule}` : ""}
                    {medication.startDate ? ` · from ${formatShortDate(medication.startDate, timeZone)}` : ""}
                    {medication.endDate ? ` · until ${formatShortDate(medication.endDate, timeZone)}` : ""}
                  </p>
                  {medication.notes ? <p className="mt-1 text-xs text-muted-foreground">{medication.notes}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {medication.takenToday} of {medication.scheduledToday} taken today
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => toggleActive(medication)} disabled={busy}>
                    {medication.active ? "Pause" : "Resume"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(medication)} aria-label={`Edit ${medication.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
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
        title={editing ? "Edit medication" : "Add a medication"}
        description="Times are when you take it — comma separated, 24-hour clock."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.name.trim()}>
              {editing ? "Save changes" : "Add medication"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Dose" hint="As prescribed">
            <Input value={form.dose} onChange={(event) => setForm({ ...form, dose: event.target.value })} placeholder="500mg" />
          </Field>
          <Field label="Times" hint="Comma separated, HH:MM">
            <Input value={form.times} onChange={(event) => setForm({ ...form, times: event.target.value })} placeholder="08:00, 20:00" />
          </Field>
          <Field label="Schedule note">
            <Input value={form.schedule} onChange={(event) => setForm({ ...form, schedule: event.target.value })} placeholder="After food" />
          </Field>
          <Field label="Active">
            <Select value={form.active ? "yes" : "no"} onChange={(event) => setForm({ ...form, active: event.target.value === "yes" })}>
              <option value="yes">Active</option>
              <option value="no">Paused</option>
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
          </Field>
          <Field label="End date">
            <Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
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
