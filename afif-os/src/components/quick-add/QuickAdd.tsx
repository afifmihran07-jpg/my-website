"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, ListTodo, Play, Trophy } from "lucide-react";
import { createTaskAction } from "@/server/services/tasks-actions";
import { startStudyAction } from "@/server/services/study-actions";
import { getOptionsAction, type PickerOptions } from "@/server/services/options-actions";
import { useStudy } from "@/components/study/StudyProvider";
import { Alert, Button, Field, Input, Modal, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

type Tab = "task" | "study" | "more";

/**
 * Low-friction capture (§35): the common things you add several times a day
 * never need a full page or a complicated form.
 */
export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { dto, refresh } = useStudy();
  const [tab, setTab] = React.useState<Tab>("task");
  const [options, setOptions] = React.useState<PickerOptions | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [task, setTask] = React.useState({ title: "", dueDate: "", priority: "medium", courseId: "" });
  const [study, setStudy] = React.useState({ title: "", courseId: "", plannedMinutes: "" });

  React.useEffect(() => {
    if (!open || options) return;
    void getOptionsAction().then((result) => {
      if (result.ok) setOptions(result.data);
    });
  }, [open, options]);

  React.useEffect(() => {
    if (!open) {
      setError(null);
      setNotice(null);
      setTab("task");
    }
  }, [open]);

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await createTaskAction({
        title: task.title,
        dueDate: task.dueDate || null,
        priority: task.priority,
        courseId: task.courseId || null,
        recurrence: "none",
      });
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTask({ title: "", dueDate: "", priority: "medium", courseId: "" });
      setNotice(`Added “${result.data.title}”.`);
      router.refresh();
    } catch {
      // A rejected action must never leave the button spinning.
      setPending(false);
      setError("The request did not complete. Reload the page and try again.");
    }
  };

  const submitStudy = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await startStudyAction({
        title: study.title,
        courseId: study.courseId || null,
        plannedMinutes: study.plannedMinutes ? Number(study.plannedMinutes) : null,
        clientKey: `qa-${crypto.randomUUID()}`,
      });
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh();
      setStudy({ title: "", courseId: "", plannedMinutes: "" });
      setNotice(`Started “${result.data.title}”.`);
      router.refresh();
    } catch {
      setPending(false);
      setError("The request did not complete. Reload the page and try again.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick add" description="Capture it now, organise it later.">
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {(
          [
            { id: "task", label: "Task", icon: ListTodo },
            { id: "study", label: "Study", icon: Play },
            { id: "more", label: "More", icon: CalendarDays },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      {error ? <Alert variant="error" className="mb-3">{error}</Alert> : null}
      {notice ? <Alert variant="success" className="mb-3">{notice}</Alert> : null}

      {tab === "task" ? (
        <form onSubmit={submitTask} className="space-y-3">
          <Field label="What needs doing?" required>
            <Input
              autoFocus
              value={task.title}
              onChange={(event) => setTask((t) => ({ ...t, title: event.target.value }))}
              placeholder="Finish CSE111 assignment 3"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <Input
                type="date"
                value={task.dueDate}
                onChange={(event) => setTask((t) => ({ ...t, dueDate: event.target.value }))}
              />
            </Field>
            <Field label="Priority">
              <Select value={task.priority} onChange={(event) => setTask((t) => ({ ...t, priority: event.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>
          <Field label="Course">
            <Select value={task.courseId} onChange={(event) => setTask((t) => ({ ...t, courseId: event.target.value }))}>
              <option value="">Not linked to a course</option>
              {options?.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" full loading={pending}>
            Add task
          </Button>
        </form>
      ) : null}

      {tab === "study" ? (
        <form onSubmit={submitStudy} className="space-y-3">
          {dto ? (
            <Alert variant="warning" title="A session is already running">
              Stop or discard “{dto.title}” before starting another one.
            </Alert>
          ) : null}
          <Field label="What are you studying?" required>
            <Input
              autoFocus
              value={study.title}
              onChange={(event) => setStudy((s) => ({ ...s, title: event.target.value }))}
              placeholder="CSE111 — Recursion"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Course">
              <Select value={study.courseId} onChange={(event) => setStudy((s) => ({ ...s, courseId: event.target.value }))}>
                <option value="">No course</option>
                {options?.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Planned minutes">
              <Input
                type="number"
                min={1}
                max={720}
                value={study.plannedMinutes}
                onChange={(event) => setStudy((s) => ({ ...s, plannedMinutes: event.target.value }))}
                placeholder="45"
              />
            </Field>
          </div>
          <Button type="submit" full loading={pending} disabled={Boolean(dto)}>
            <Play className="h-4 w-4" />
            Start study
          </Button>
          <p className="text-[11px] text-muted-foreground">
            University class time is never counted here — this timer is for your own study only.
          </p>
        </form>
      ) : null}

      {tab === "more" ? (
        <ul className="space-y-1.5">
          {[
            { href: "/learning/notes", label: "Note", icon: BookOpen, phase: 6 },
            { href: "/learning/books", label: "Book", icon: BookOpen, phase: 5 },
            { href: "/calendar", label: "Event", icon: CalendarDays, phase: 2 },
            { href: "/academic/achievements", label: "Achievement", icon: Trophy, phase: 5 },
          ].map((item) => (
            <li key={item.href}>
              <button
                onClick={() => {
                  onClose();
                  router.push(item.href);
                }}
                className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">Add {item.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Phase {item.phase}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  );
}
