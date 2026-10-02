"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";

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
  Progress,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { formatHoursMinutes, formatShortDate } from "@/lib/format";
import {
  createGoalAction,
  createProjectAction,
  setProjectStatusAction,
  updateProjectAction,
} from "@/server/services/projects-actions";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_TONES } from "@/lib/labels";
import {
  type SerializedProject,} from "@/server/services/projects-validation";;

type Summary = {
  total: number;
  active: number;
  planning: number;
  paused: number;
  completed: number;
  openTasks: number;
  studySeconds: number;
};

type Option = { id: string; title?: string; name?: string };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "planning", label: "Planning" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
] as const;

const emptyForm = {
  name: "",
  description: "",
  status: "planning" as SerializedProject["status"],
  startDate: "",
  targetDate: "",
  goalId: "",
  url: "",
};

export function ProjectsClient({
  projects,
  summary,
  goals,
  timeZone,
}: {
  projects: SerializedProject[];
  summary: Summary;
  goals: Option[];
  timeZone: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedProject | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [newGoal, setNewGoal] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visible = filter === "all" ? projects : projects.filter((project) => project.status === filter);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(project: SerializedProject) {
    setEditing(project);
    setForm({
      name: project.name,
      description: project.description ?? "",
      status: project.status,
      startDate: project.startDate ?? "",
      targetDate: project.targetDate ?? "",
      goalId: project.goalId ?? "",
      url: project.url ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name,
      description: form.description,
      status: form.status,
      startDate: form.startDate || null,
      targetDate: form.targetDate || null,
      goalId: form.goalId || null,
      url: form.url,
    };
    const result = editing ? await updateProjectAction(editing.id, payload) : await createProjectAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function addGoal() {
    if (!newGoal.trim()) return;
    setBusy(true);
    const result = await createGoalAction({ title: newGoal });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewGoal("");
    router.refresh();
  }

  async function setStatus(project: SerializedProject, status: SerializedProject["status"]) {
    setBusy(true);
    const result = await setProjectStatusAction(project.id, status);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function archive(project: SerializedProject) {
    setBusy(true);
    const result = await updateProjectAction(project.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && !formOpen ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active" value={String(summary.active)} hint={`${summary.planning} planning · ${summary.paused} paused`} />
        <StatCard label="Completed" value={String(summary.completed)} hint={`${summary.total} projects total`} />
        <StatCard label="Open tasks" value={String(summary.openTasks)} hint="Across all live projects" />
        <StatCard label="Study logged" value={formatHoursMinutes(summary.studySeconds)} hint="From the study timer" />
      </div>

      <Card>
        <CardHeader
          title="Projects"
          subtitle="Progress comes from your real tasks and study sessions — never a manual slider."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-border px-4 pb-3">
          {FILTERS.map((item) => {
            const count = item.key === "all" ? projects.length : projects.filter((p) => p.status === item.key).length;
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
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-8 w-8" />}
            title={projects.length === 0 ? "No projects yet" : "Nothing in this list"}
            description="Create a project to group tasks, notes, study sessions and achievements around one outcome."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> New project
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((project) => (
              <li key={project.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{project.name}</p>
                      <Badge tone={PROJECT_STATUS_TONES[project.status]}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
                      {project.goalTitle ? <Badge tone="neutral">Goal: {project.goalTitle}</Badge> : null}
                    </div>
                    {project.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {project.status !== "completed" ? (
                      <Button size="sm" variant="secondary" onClick={() => setStatus(project, "completed")} disabled={busy}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setStatus(project, "active")} disabled={busy}>
                        Reopen
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(project)} aria-label={`Edit ${project.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(project)} disabled={busy} aria-label={`Archive ${project.name}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {project.taskCompletion !== null ? (
                  <div className="mt-3">
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">
                        {project.tasksDone} of {project.tasksTotal} tasks done
                      </span>
                      <span className="font-medium">{project.taskCompletion}%</span>
                    </div>
                    <Progress value={project.taskCompletion} tone={project.taskCompletion === 100 ? "accent" : "primary"} />
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-muted-foreground">No tasks linked yet — add tasks to this project to see real progress.</p>
                )}

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {project.studySessionCount ? (
                    <span>
                      {formatHoursMinutes(project.studySeconds)} studied · {project.studySessionCount} sessions
                    </span>
                  ) : null}
                  {project.noteCount ? <span>{project.noteCount} notes</span> : null}
                  {project.achievementCount ? <span>{project.achievementCount} achievements</span> : null}
                  {project.targetDate ? (
                    <span className={project.daysToTarget !== null && project.daysToTarget < 0 ? "text-danger" : ""}>
                      Target {formatShortDate(project.targetDate, timeZone)}
                      {project.daysToTarget !== null
                        ? project.daysToTarget < 0
                          ? ` · ${Math.abs(project.daysToTarget)}d overdue`
                          : ` · ${project.daysToTarget}d left`
                        : ""}
                    </span>
                  ) : null}
                  {project.completedAt ? <span>Completed {formatShortDate(project.completedAt, timeZone)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit project" : "New project"}
        description="Link it to a goal so the work has a reason behind it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.name.trim()}>
              {editing ? "Save changes" : "Create project"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Personal OS" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SerializedProject["status"] })}>
              {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Goal">
            <Select value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })}>
              <option value="">No goal</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Label>New goal</Label>
            <div className="flex gap-2">
              <Input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Become a better systems thinker" />
              <Button variant="secondary" onClick={addGoal} disabled={busy || !newGoal.trim()}>
                Add
              </Button>
            </div>
          </div>
          <Field label="Start date">
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Target date">
            <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </Field>
          <Field label="Link" className="sm:col-span-2" hint="Repository, demo or write-up">
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
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
