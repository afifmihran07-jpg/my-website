"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Clock, Disc3, Pause, Play, Trash2 } from "lucide-react";
import {
  discardStudyAction,
  pauseStudyAction,
  resumeStudyAction,
  startStudyAction,
  stopStudyAction,
} from "@/server/services/study-actions";
import { useStudy } from "@/components/study/StudyProvider";
import type { PickerOptions } from "@/server/services/options-actions";
import type { StudyDto } from "@/server/services/study";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { formatDuration, formatHoursMinutes, formatTimeOfDay } from "@/lib/format";

type TodayInfo = {
  totalSeconds: number;
  universitySeconds: number;
  sessionCount: number;
  sessions: Array<{ id: string; title: string; topic: string | null; courseCode: string | null; durationSeconds: number }>;
};

export function StudyTimerPage({
  initialSession,
  options,
  today,
  timeZone,
}: {
  initialSession: StudyDto | null;
  options: PickerOptions;
  today: TodayInfo;
  timeZone: string;
}) {
  const { dto: liveDto, elapsed, setDto, refresh } = useStudy();
  const router = useRouter();

  // Seed the shared context from the server render so there is no flash.
  React.useEffect(() => {
    if (initialSession && !liveDto) setDto(initialSession);
  }, [initialSession, liveDto, setDto]);

  const dto = liveDto ?? initialSession;

  return (
    <div className="space-y-4">
      <TimerPanel
        dto={dto}
        elapsed={elapsed}
        options={options}
        timeZone={timeZone}
        onRefresh={refresh}
        router={router}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Today"
            subtitle={`${today.sessionCount} session${today.sessionCount === 1 ? "" : "s"} recorded`}
            icon={<Clock className="h-4 w-4" />}
            action={
              <Link href="/study/history" className="text-xs text-primary hover:underline">
                Full history
              </Link>
            }
          />
          <div className="px-4 py-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="tabular text-sm font-semibold">{formatHoursMinutes(today.totalSeconds)}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Self study</p>
              </div>
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="tabular text-sm font-semibold">{formatHoursMinutes(today.universitySeconds)}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">University class</p>
              </div>
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="tabular text-sm font-semibold">
                  {formatHoursMinutes(today.totalSeconds + today.universitySeconds)}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Total academic</p>
              </div>
            </div>

            <ul className="mt-3 divide-y divide-border">
              {today.sessions.length === 0 ? (
                <li className="py-3 text-center text-xs text-muted-foreground">No completed sessions today.</li>
              ) : (
                today.sessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-2 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate">
                      {session.courseCode ? `${session.courseCode}${session.topic ? ` — ${session.topic}` : ""}` : session.title}
                    </span>
                    <span className="tabular shrink-0 font-medium">{formatHoursMinutes(session.durationSeconds)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="How this timer works" icon={<AlertCircle className="h-4 w-4" />} />
          <ul className="space-y-2 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Only your own study is counted.</strong> University class time is
              tracked separately from your timetable and never enters these totals.
            </li>
            <li>
              <strong className="text-foreground">It survives a refresh.</strong> The session lives in PostgreSQL; this
              page reads it back on load, so closing the tab does not lose your time.
            </li>
            <li>
              <strong className="text-foreground">Duration is computed on the server</strong> from the recorded start,
              pause and stop instants — the browser cannot inflate or shrink it.
            </li>
            <li>
              <strong className="text-foreground">Stopping is idempotent.</strong> Pressing “Stop &amp; save” twice
              saves one session, not two.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TimerPanel({
  dto,
  elapsed,
  options,
  timeZone,
  onRefresh,
  router,
}: {
  dto: StudyDto | null;
  elapsed: number;
  options: PickerOptions;
  timeZone: string;
  onRefresh: () => Promise<void>;
  router: ReturnType<typeof useRouter>;
}) {
  const [form, setForm] = React.useState({
    title: "",
    courseId: "",
    topic: "",
    bookId: "",
    projectId: "",
    plannedMinutes: "",
  });
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);

  const act = async (name: string, fn: () => Promise<unknown>) => {
    setPending(name);
    setError(null);
    try {
      const result = (await fn()) as { ok: boolean; error?: string; data?: StudyDto };
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setSaved(name === "stop" ? `Saved “${result.data?.title}”.` : null);
    } finally {
      setPending(null);
      await onRefresh();
      router.refresh();
    }
  };

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    await act("start", () =>
      startStudyAction({
        title: form.title,
        courseId: form.courseId || null,
        topic: form.topic || null,
        bookId: form.bookId || null,
        projectId: form.projectId || null,
        plannedMinutes: form.plannedMinutes ? Number(form.plannedMinutes) : null,
        clientKey: `timer-${crypto.randomUUID()}`,
      }),
    );
    setForm({ title: "", courseId: "", topic: "", bookId: "", projectId: "", plannedMinutes: "" });
  };

  return (
    <Card>
      <CardHeader
        title={dto ? "Session in progress" : "Start a self-study session"}
        subtitle={dto ? "Pausing banks the time; stopping writes the session permanently." : "University class time is tracked separately."}
        icon={<Disc3 className="h-4 w-4" />}
        action={dto ? <Badge tone={dto.status === "paused" ? "warning" : "accent"}>{dto.status}</Badge> : null}
      />

      <div className="px-4 py-4">
        {error ? (
          <Alert variant="error" className="mb-4" title="Study session could not be saved">
            {error}
          </Alert>
        ) : null}
        {saved ? (
          <Alert variant="success" className="mb-4">
            {saved}
          </Alert>
        ) : null}

        {dto ? (
          <div className="flex flex-col items-center gap-4">
            <p
              className={`tabular text-6xl font-semibold tracking-tight sm:text-7xl ${
                dto.status === "paused" ? "text-warning" : ""
              }`}
            >
              {formatDuration(elapsed)}
            </p>
            <div className="text-center">
              <p className="text-base font-medium">{dto.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dto.courseCode ? `${dto.courseCode}${dto.topic ? ` — ${dto.topic}` : ""}` : dto.topic ?? "Self study"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Started {formatTimeOfDay(new Date(dto.startedAt), timeZone)}
                {dto.plannedMinutes ? ` · planned ${dto.plannedMinutes}m` : ""}
              </p>
            </div>

            <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-3">
              {dto.status === "active" ? (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => act("pause", pauseStudyAction)}
                  loading={pending === "pause"}
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => act("resume", resumeStudyAction)}
                  loading={pending === "resume"}
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              )}
              <Button
                variant="success"
                size="lg"
                onClick={() => act("stop", () => stopStudyAction({ notes: notes || undefined }))}
                loading={pending === "stop"}
                className="col-span-1 sm:col-span-2"
              >
                <Check className="h-4 w-4" />
                Stop &amp; save
              </Button>
            </div>

            <div className="w-full max-w-md">
              <Label htmlFor="stop-notes">Notes for this session (optional)</Label>
              <Textarea
                id="stop-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What did you cover? What is still unclear?"
              />
            </div>

            <button
              onClick={() => act("discard", discardStudyAction)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-danger hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Discard this session
            </button>
          </div>
        ) : (
          <form onSubmit={start} className="mx-auto max-w-xl space-y-3">
            <Field label="What are you studying?" required hint="Be specific — this becomes the session title.">
              <Input
                autoFocus
                value={form.title}
                onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
                placeholder="CSE111 — Recursion"
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Course (optional)">
                <Select value={form.courseId} onChange={(event) => setForm((f) => ({ ...f, courseId: event.target.value }))}>
                  <option value="">No course</option>
                  {options.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} — {course.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Topic (optional)">
                <Input
                  value={form.topic}
                  onChange={(event) => setForm((f) => ({ ...f, topic: event.target.value }))}
                  placeholder="Master theorem"
                />
              </Field>
              <Field label="Book (optional)">
                <Select value={form.bookId} onChange={(event) => setForm((f) => ({ ...f, bookId: event.target.value }))}>
                  <option value="">No book</option>
                  {options.books.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Project (optional)">
                <Select
                  value={form.projectId}
                  onChange={(event) => setForm((f) => ({ ...f, projectId: event.target.value }))}
                >
                  <option value="">No project</option>
                  {options.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Planned duration in minutes (optional)">
              <Input
                type="number"
                min={1}
                max={720}
                value={form.plannedMinutes}
                onChange={(event) => setForm((f) => ({ ...f, plannedMinutes: event.target.value }))}
                placeholder="45"
              />
            </Field>

            <Button type="submit" size="lg" full loading={pending === "start"} disabled={!form.title.trim()}>
              <Play className="h-4 w-4" />
              Start study
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
