"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  GraduationCap,
  ListTodo,
  Play,
  Rocket,
  Sparkles,
  Square,
  Timer,
} from "lucide-react";
import { useStudy } from "@/components/study/StudyProvider";
import { startStudyAction, stopStudyAction } from "@/server/services/study-actions";
import { setTaskStatusAction } from "@/server/services/tasks-actions";
import type { CurrentState, NextAction, Deadline } from "@/server/services/dashboard";
import { Badge, Button, Card, CardHeader, EmptyState, Progress, SectionTitle } from "@/components/ui/primitives";
import { formatDay, formatDuration, formatHoursMinutes, greetingFor, relativeTime, barPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

export type DashboardProps = {
  timeZone: string;
  dayKey: string;
  greetingHour: number;
  firstName: string;
  unreadCount: number;
  state: CurrentState;
  today: {
    classes: Array<{ id: string; title: string; code: string | null; room: string | null; start: string; end: string }>;
    tasks: { today: number; overdue: number; completedToday: number; items: Array<{ id: string; title: string; status: string; priority: string }> };
    reminders: Array<{ id: string; title: string; remindAt: string; status: string }>;
  };
  deadlines: Deadline[];
  nextActions: NextAction[];
  study: {
    totalSeconds: number;
    universitySeconds: number;
    sessionCount: number;
    sessions: Array<{
      id: string;
      title: string;
      topic: string | null;
      courseCode: string | null;
      courseName: string | null;
      color: string | null;
      durationSeconds: number;
      startedAt: string;
    }>;
    byCourse: Array<{ label: string; seconds: number; color: string | null }>;
    weekTotalSeconds: number;
    weekPerDay: Array<{ dayKey: string; seconds: number; sessions: number }>;
    weekActiveDays: number;
  };
};

export function DashboardView(props: DashboardProps) {
  return (
    <div className="space-y-4">
      <ClockHeader
        timeZone={props.timeZone}
        greeting={greetingFor(props.greetingHour)}
        firstName={props.firstName}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NextActionsCard actions={props.nextActions} />
        </div>
        <CurrentStateCard state={props.state} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StudyNowCard study={props.study} />
        <TodayCard today={props.today} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DeadlinesCard deadlines={props.deadlines} />
        <WeekCard study={props.study} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ClockHeader({ timeZone, greeting, firstName }: { timeZone: string; greeting: string; firstName: string }) {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone }).format(now)
    : "—";
  const date = now ? formatDay(now, timeZone) : "";

  return (
    <section className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {greeting}, {firstName}
        </h1>
        <p className="mt-0.5 text-xs capitalize text-muted-foreground sm:text-sm">{date}</p>
      </div>
      <p className="tabular text-2xl font-semibold tracking-tight text-muted-foreground sm:text-3xl">{time}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function NextActionsCard({ actions }: { actions: NextAction[] }) {
  return (
    <Card className="h-full">
      <CardHeader
        title="What should I do now?"
        subtitle="Derived from your schedule, deadlines and study record"
        icon={<Sparkles className="h-4 w-4" />}
        action={
          <Link href="/advisor" className="text-xs text-primary hover:underline">
            Ask the advisor
          </Link>
        }
      />
      {actions.length === 0 ? (
        <EmptyState
          icon={<Check className="h-8 w-8" />}
          title="Nothing is demanding your attention"
          description="No overdue tasks, no imminent deadlines and today's study target is met."
        />
      ) : (
        <ul className="divide-y divide-border">
          {actions.map((action) => (
            <li key={action.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <span
                className={cn(
                  "mt-1 h-2 w-2 shrink-0 rounded-full",
                  action.tone === "urgent" ? "bg-danger" : action.tone === "focus" ? "bg-warning" : "bg-accent",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{action.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{action.why}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {action.actions.map((item) => (
                    <Link
                      key={item.label + item.href}
                      href={item.href}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted"
                    >
                      {item.label}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function CurrentStateCard({ state }: { state: CurrentState }) {
  const rows = [
    { label: "Active courses", value: state.activeCourses, href: "/academic/courses", icon: BookOpen },
    { label: "Active projects", value: state.activeProjects, href: "/projects", icon: ListTodo },
    { label: "Books reading", value: state.booksReading, href: "/learning/books", icon: BookOpen },
    { label: "Active opportunities", value: state.activeOpportunities, href: "/opportunities", icon: Rocket },
    { label: "Deadlines (7 days)", value: state.upcomingDeadlineCount, href: "/tasks", icon: CalendarDays },
  ];

  return (
    <Card className="h-full">
      <CardHeader
        title="Current state"
        subtitle={state.semester ? state.semester.name : "No active semester"}
        icon={<GraduationCap className="h-4 w-4" />}
        action={state.cgpa !== null ? <Badge tone="primary">CGPA {state.cgpa.toFixed(2)}</Badge> : null}
      />
      <div className="px-4 py-3">
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.label}>
              <Link href={row.href} className="flex items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted">
                <row.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-xs text-muted-foreground">{row.label}</span>
                <span className="tabular text-sm font-semibold">{row.value}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Self-study this week</p>
          <p className="tabular mt-0.5 text-lg font-semibold">{formatHoursMinutes(state.weekStudySeconds)}</p>
          <Progress value={state.weekStudySeconds} max={7 * 2 * 3600} className="mt-2" tone="accent" />
          <p className="mt-1 text-[11px] text-muted-foreground">Against a 2h/day reference — evidence, not a score.</p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function StudyNowCard({ study }: { study: DashboardProps["study"] }) {
  const { dto, elapsed, loading, refresh } = useStudy();
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const start = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    setError(null);
    try {
      const result = await startStudyAction({ title, clientKey: `dash-${crypto.randomUUID()}` });
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTitle("");
      await refresh();
      router.refresh();
    } catch {
      setPending(false);
      setError("The request did not complete. Reload the page and try again.");
    }
  };

  const stop = async () => {
    setPending(true);
    try {
      const result = await stopStudyAction();
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await refresh();
      router.refresh();
    } catch {
      setPending(false);
      setError("The request did not complete. Reload the page and try again.");
    }
  };

  const planned = dto?.plannedMinutes ? dto.plannedMinutes * 60 : null;
  const plannedProgress = planned ? barPercent(elapsed, planned) : null;

  return (
    <Card className="h-full">
      <CardHeader
        title="Self-study now"
        subtitle="University class time is never counted here"
        icon={<Timer className="h-4 w-4" />}
        action={
          <Link href="/study" className="text-xs text-primary hover:underline">
            Full timer
          </Link>
        }
      />

      <div className="px-4 py-4">
        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        ) : dto ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-5">
            <p className={cn("tabular text-4xl font-semibold tracking-tight", dto.status === "paused" && "text-warning")}>
              {formatDuration(elapsed)}
            </p>
            <p className="max-w-full truncate text-sm font-medium">{dto.title}</p>
            {plannedProgress !== null ? (
              <div className="w-full">
                <Progress value={plannedProgress} tone={plannedProgress >= 100 ? "accent" : "primary"} />
                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                  planned {Math.round(plannedProgress)}%
                </p>
              </div>
            ) : null}
            <div className="flex w-full gap-2">
              <Button variant="secondary" full onClick={() => router.push("/study")} disabled={pending}>
                Open timer
              </Button>
              <Button variant="success" full onClick={stop} loading={pending}>
                <Check className="h-4 w-4" />
                Stop &amp; save
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={start} className="space-y-2">
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What are you studying?"
                className="h-11 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/25"
                aria-label="What are you studying?"
              />
              <Button type="submit" size="lg" loading={pending} disabled={!title.trim()}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            </div>
            {error ? <p className="text-xs text-danger">{error}</p> : null}
          </form>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Self-study today" value={formatHoursMinutes(study.totalSeconds)} />
          <Metric label="Class today" value={formatHoursMinutes(study.universitySeconds)} />
          <Metric label="Sessions" value={String(study.sessionCount)} />
        </div>

        {study.sessions.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {study.sessions.map((session) => (
              <li key={session.id} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: session.color ?? "rgb(99 102 241)" }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {session.courseCode ? `${session.courseCode}${session.topic ? ` — ${session.topic}` : ""}` : session.title}
                </span>
                <span className="tabular shrink-0 text-muted-foreground">{formatHoursMinutes(session.durationSeconds)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No self-study recorded today yet.</p>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2 py-2">
      <p className="tabular text-sm font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TodayCard({ today }: { today: DashboardProps["today"] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  const complete = async (id: string) => {
    setBusy(id);
    try {
      await setTaskStatusAction(id, "completed");
      router.refresh();
    } finally {
      // Always clear the row's busy state, even when the action rejects.
      setBusy(null);
    }
  };

  const nextClass = today.classes.find((c) => Date.parse(c.end) > Date.now());

  return (
    <Card className="h-full">
      <CardHeader
        title="Today"
        subtitle={`${today.tasks.completedToday} done · ${today.tasks.today} due · ${today.tasks.overdue} overdue`}
        icon={<Clock className="h-4 w-4" />}
        action={
          <Link href="/today" className="text-xs text-primary hover:underline">
            Open
          </Link>
        }
      />
      <div className="space-y-3 px-4 py-3">
        <div>
          <SectionTitle>Classes</SectionTitle>
          {today.classes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No university classes scheduled today.</p>
          ) : (
            <ul className="space-y-1.5">
              {today.classes.map((klass) => {
                const isNext = nextClass?.id === klass.id;
                return (
                  <li
                    key={klass.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                      isNext ? "border-primary/40 bg-primary/10" : "border-border",
                    )}
                  >
                    <span className="tabular shrink-0 text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(
                        new Date(klass.start),
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {klass.code ? `${klass.code} — ` : ""}
                      {klass.title}
                    </span>
                    {isNext ? <Badge tone="primary">Next</Badge> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <SectionTitle>Tasks</SectionTitle>
          {today.tasks.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing due today.</p>
          ) : (
            <ul className="space-y-1">
              {today.tasks.items.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => complete(task.id)}
                    disabled={busy === task.id}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded border border-border text-transparent transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
                    aria-label={`Complete ${task.title}`}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  {task.priority === "urgent" || task.priority === "high" ? (
                    <Badge tone={task.priority === "urgent" ? "danger" : "warning"}>{task.priority}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {today.reminders.length > 0 ? (
          <div>
            <SectionTitle>Reminders</SectionTitle>
            <ul className="space-y-1">
              {today.reminders.map((reminder) => (
                <li key={reminder.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Square className="h-3 w-3" />
                  <span className="min-w-0 flex-1 truncate">{reminder.title}</span>
                  <span className="tabular shrink-0">{relativeTime(new Date(reminder.remindAt))}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DeadlinesCard({ deadlines }: { deadlines: Deadline[] }) {
  return (
    <Card className="h-full">
      <CardHeader
        title="Upcoming deadlines"
        subtitle="Overdue tasks plus the next 14 days"
        icon={<CalendarDays className="h-4 w-4" />}
      />
      {deadlines.length === 0 ? (
        <EmptyState icon={<Check className="h-8 w-8" />} title="Nothing due in the next two weeks" />
      ) : (
        <ul className="divide-y divide-border">
          {deadlines.map((deadline) => (
            <li key={`${deadline.kind}-${deadline.id}`}>
              <Link href={deadline.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50">
                <Badge tone={deadline.kind === "assessment" ? "danger" : deadline.kind === "opportunity" ? "warning" : "neutral"}>
                  {deadline.kind}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-xs">{deadline.title}</span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">{deadline.dueKey.slice(5)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function WeekCard({ study }: { study: DashboardProps["study"] }) {
  const peak = Math.max(1, ...study.weekPerDay.map((d) => d.seconds));
  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <Card className="h-full">
      <CardHeader
        title="This week"
        subtitle={`${study.weekActiveDays} of 7 days with self-study`}
        icon={<Timer className="h-4 w-4" />}
        action={
          <Link href="/study/history" className="text-xs text-primary hover:underline">
            History
          </Link>
        }
      />
      <div className="px-4 py-4">
        <div className="flex h-28 items-end gap-1.5">
          {study.weekPerDay.map((day) => {
            const height = barPercent(day.seconds, peak, 0);
            const weekday = new Date(`${day.dayKey}T00:00:00Z`).getUTCDay();
            return (
              <div key={day.dayKey} className="flex flex-1 flex-col items-center gap-1">
                <span className="tabular text-[9px] text-muted-foreground">
                  {day.seconds > 0 ? `${Math.round(day.seconds / 3600)}h` : ""}
                </span>
                <div className="flex h-20 w-full items-end overflow-hidden rounded bg-muted">
                  <div
                    className={cn("w-full rounded transition-all", day.seconds > 0 ? "bg-primary" : "bg-transparent")}
                    style={{ height: `${Math.max(day.seconds > 0 ? 6 : 0, height)}%` }}
                    title={`${day.dayKey}: ${formatHoursMinutes(day.seconds)}`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{weekdayLabels[weekday]}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">Total self-study this week</span>
          <span className="tabular text-sm font-semibold">{formatHoursMinutes(study.weekTotalSeconds)}</span>
        </div>

        {study.byCourse.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            <SectionTitle>By subject</SectionTitle>
            {study.byCourse.map((slice) => (
              <div key={slice.label} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color ?? "rgb(99 102 241)" }} />
                <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                <span className="tabular shrink-0 text-muted-foreground">{formatHoursMinutes(slice.seconds)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

