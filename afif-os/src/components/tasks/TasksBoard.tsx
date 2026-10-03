"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCcw, X } from "lucide-react";
import { createTaskAction, setTaskStatusAction } from "@/server/services/tasks-actions";
import type { PickerOptions } from "@/server/services/options-actions";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  courseCode: string | null;
  projectName: string | null;
  estimatedMinutes: number | null;
};

const TABS = [
  { id: "today", label: "Today" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "someday", label: "Someday" },
  { id: "done", label: "Recently done" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TasksBoard({
  buckets,
  options,
  today,
}: {
  buckets: Record<Exclude<TabId, "done">, TaskRow[]> & { done: TaskRow[] };
  options: PickerOptions;
  today: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>("today");
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", dueDate: "", priority: "medium", courseId: "", projectId: "" });
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const rows = buckets[tab];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await createTaskAction({
        title: form.title,
        dueDate: form.dueDate || null,
        priority: form.priority,
        courseId: form.courseId || null,
        projectId: form.projectId || null,
        recurrence: "none",
      });
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setForm({ title: "", dueDate: "", priority: "medium", courseId: "", projectId: "" });
      setAdding(false);
      router.refresh();
    } catch {
      setPending(false);
      setError("The request did not complete. Reload the page and try again.");
    }
  };

  const setStatus = async (id: string, status: "completed" | "todo") => {
    setBusy(id);
    try {
      await setTaskStatusAction(id, status);
      router.refresh();
    } finally {
      // Always clear the row's busy state, even when the action rejects.
      setBusy(null);
    }
  };

  const counts: Record<TabId, number> = {
    today: buckets.today.length,
    overdue: buckets.overdue.length,
    upcoming: buckets.upcoming.length,
    someday: buckets.someday.length,
    done: buckets.done.length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              tab === item.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
            <span className="tabular ml-1.5 opacity-70">{counts[item.id]}</span>
          </button>
        ))}
        <Button size="sm" className="ml-auto" onClick={() => setAdding((v) => !v)}>
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          New task
        </Button>
      </div>

      {adding ? (
        <Card className="p-4">
          <form onSubmit={submit} className="space-y-3">
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <Field label="Title" required>
              <Input
                autoFocus
                value={form.title}
                onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
                placeholder="Write the report introduction"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Due">
                <Input type="date" value={form.dueDate} onChange={(event) => setForm((f) => ({ ...f, dueDate: event.target.value }))} />
              </Field>
              <Field label="Priority">
                <Select value={form.priority} onChange={(event) => setForm((f) => ({ ...f, priority: event.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>
              <Field label="Course">
                <Select value={form.courseId} onChange={(event) => setForm((f) => ({ ...f, courseId: event.target.value }))}>
                  <option value="">None</option>
                  {options.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Project">
                <Select value={form.projectId} onChange={(event) => setForm((f) => ({ ...f, projectId: event.target.value }))}>
                  <option value="">None</option>
                  {options.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={pending} disabled={!form.title.trim()}>
                Save task
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={TABS.find((t) => t.id === tab)?.label ?? "Tasks"}
          subtitle={
            tab === "overdue"
              ? "Past their due date and still open"
              : tab === "someday"
                ? "No due date — revisit when you have capacity"
                : tab === "done"
                  ? "Most recently completed"
                  : `Open work for ${today}`
          }
        />
        {rows.length === 0 ? (
          <EmptyState title="Nothing here" description="Add a task with the button above." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((task) => {
              const isDone = task.status === "completed";
              return (
                <li key={task.id} className="flex items-start gap-3 px-4 py-2.5">
                  <button
                    onClick={() => setStatus(task.id, isDone ? "todo" : "completed")}
                    disabled={busy === task.id}
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors disabled:opacity-50",
                      isDone ? "border-accent bg-accent text-[#04150f]" : "border-border text-transparent hover:border-accent hover:text-accent",
                    )}
                    aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-snug", isDone && "text-muted-foreground line-through")}>{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {task.courseCode ? <Badge tone="primary">{task.courseCode}</Badge> : null}
                      {task.projectName ? <Badge tone="warning">{task.projectName}</Badge> : null}
                      {task.dueDate ? (
                        <Badge tone={task.dueDate < today && !isDone ? "danger" : "neutral"}>due {task.dueDate}</Badge>
                      ) : (
                        <Badge tone="neutral">no date</Badge>
                      )}
                      {task.estimatedMinutes ? <Badge tone="neutral">{task.estimatedMinutes}m</Badge> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>
                      {task.priority}
                    </Badge>
                    {isDone ? (
                      <button
                        onClick={() => setStatus(task.id, "todo")}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reopen
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
