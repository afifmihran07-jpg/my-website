"use client";

import * as React from "react";
import { LineChart } from "lucide-react";

import { Alert, Badge, Card, CardHeader, EmptyState, Label, Progress } from "@/components/ui/primitives";
import { barPercent, formatHoursMinutes } from "@/lib/format";
import { STAGE_LABELS, type MasteryStage } from "@/server/services/common-validation";

type Slice = { key: string; label: string; seconds: number; sessions: number; percent: number };
type TrendPoint = { dayKey: string; seconds: number; sessions: number };

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
] as const;

export function AnalyticsClient({
  range,
  totals,
  trend,
  distribution,
  byHour,
  byWeekday,
  taskStats,
  reading,
  learning,
  opportunities,
  projects,
  achievements,
  academic,
  timeZone,
}: {
  range: 7 | 30 | 90 | 365;
  totals: {
    seconds: number;
    sessions: number;
    daysStudied: number;
    consistency: number;
    averagePerStudiedDay: number;
    longestSessionSeconds: number;
    previousSeconds: number;
    changePercent: number | null;
  };
  trend: TrendPoint[];
  distribution: { byCourse: Slice[]; byBook: Slice[]; byProject: Slice[]; unlinkedSeconds: number };
  byHour: { hour: number; seconds: number; sessions: number }[];
  byWeekday: { weekday: number; label: string; seconds: number; sessions: number }[];
  taskStats: {
    open: number;
    completed: number;
    completedInRange: number;
    overdue: number;
    trend: { dayKey: string; count: number }[];
    byPriority: { priority: string; count: number }[];
    byBucket: { bucket: string; count: number }[];
  };
  reading: {
    pages: number;
    seconds: number;
    sessions: number;
    daysRead: number;
    booksReading: number;
    booksCompleted: number;
    byBook: { key: string; label: string; pages: number; seconds: number }[];
  };
  learning: {
    concepts: number;
    notes: number;
    openQuestions: number;
    answeredQuestions: number;
    evidence: number;
    evidenceInRange: number;
    skillsByStage: { stage: string; count: number }[];
    conceptsByStatus: { status: string; count: number }[];
  };
  opportunities: {
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
    applied: number;
    accepted: number;
    rejected: number;
    successRate: number | null;
  };
  projects: { id: string; name: string; status: string; studySeconds: number; studyInRange: number; tasksTotal: number; tasksDone: number }[];
  achievements: { byYear: { year: string; count: number }[]; byCategory: { category: string; count: number }[] };
  academic: { selfStudySeconds: number; classSeconds: number; weeklyClassSeconds: number; weeks: number };
  timeZone: string;
}) {
  const peakSeconds = Math.max(...trend.map((point) => point.seconds), 1);
  const peakHour = byHour.reduce((best, row) => (row.seconds > best.seconds ? row : best), byHour[0]!);
  const bestWeekday = byWeekday.reduce((best, row) => (row.seconds > best.seconds ? row : best), byWeekday[0]!);

  const hasStudy = totals.seconds > 0;

  return (
    <div className="space-y-6">
      <Alert variant="info" title="No productivity score">
        Every number on this page is a count, a sum or a distribution of things you actually recorded. There is no
        single score — a number that blended study hours, tasks and reading would be invented, and it would become
        the thing you optimise instead of the work.
      </Alert>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((item) => (
          <a
            key={item.value}
            href={`/analytics?range=${item.value}`}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              range === item.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Self-study" value={formatHoursMinutes(totals.seconds)} hint={`${totals.sessions} sessions · ${totals.daysStudied} days`} />
        <StatCard
          label="Consistency"
          value={`${totals.consistency}%`}
          hint={`${totals.daysStudied} of ${range} days had study logged`}
        />
        <StatCard
          label="Per studied day"
          value={formatHoursMinutes(totals.averagePerStudiedDay)}
          hint={`Longest session ${formatHoursMinutes(totals.longestSessionSeconds)}`}
        />
        <StatCard
          label="vs previous window"
          value={totals.changePercent === null ? "—" : `${totals.changePercent > 0 ? "+" : ""}${totals.changePercent}%`}
          hint={totals.changePercent === null ? "No data in the previous window" : `Previous: ${formatHoursMinutes(totals.previousSeconds)}`}
        />
      </div>

      <Card>
        <CardHeader
          title="Study time"
          subtitle={`Daily totals for the last ${range} days. Empty days are shown as zero — they are data, not gaps.`}
        />
        {hasStudy ? (
          <div className="p-4">
            <div className="flex h-32 items-end gap-[2px]">
              {trend.map((point) => (
                <div
                  key={point.dayKey}
                  className="group relative flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
                  style={{ height: `${Math.max(barPercent(point.seconds, peakSeconds), point.seconds > 0 ? 3 : 1)}%` }}
                  title={`${point.dayKey}: ${formatHoursMinutes(point.seconds)} · ${point.sessions} sessions`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{trend[0]?.dayKey}</span>
              <span>{trend[trend.length - 1]?.dayKey}</span>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<LineChart className="h-8 w-8" />}
            title="No study sessions in this window"
            description="Start the study timer and this fills in with real data."
          />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where the time went — courses" subtitle="Study sessions linked to a course" />
          <SliceList rows={distribution.byCourse} empty="No study linked to a course in this window." />
        </Card>
        <Card>
          <CardHeader title="Where the time went — projects" subtitle="Study sessions linked to a project" />
          <SliceList rows={distribution.byProject} empty="No study linked to a project in this window." />
        </Card>
        <Card>
          <CardHeader title="Where the time went — books" subtitle="Study sessions linked to a book" />
          <SliceList rows={distribution.byBook} empty="No study linked to a book in this window." />
        </Card>
        <Card>
          <CardHeader title="Unlinked study" subtitle="Time logged without attaching it to anything" />
          <div className="p-4">
            <p className="text-2xl font-semibold">{formatHoursMinutes(distribution.unlinkedSeconds)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {distribution.unlinkedSeconds > 0
                ? "Attach a course, book or project when you start the timer and this time becomes attributable."
                : "Everything you logged in this window was attached to something."}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Time of day"
            subtitle={`Most study at ${String(peakHour.hour).padStart(2, "0")}:00 — ${formatHoursMinutes(peakHour.seconds)} across ${peakHour.sessions} sessions`}
          />
          <div className="flex h-24 items-end gap-[2px] p-4 pt-0">
            {byHour.map((row) => {
              const max = Math.max(...byHour.map((item) => item.seconds), 1);
              return (
                <div
                  key={row.hour}
                  className="flex-1 rounded-t bg-accent/70"
                  style={{ height: `${Math.max(barPercent(row.seconds, max), row.seconds > 0 ? 4 : 1)}%` }}
                  title={`${String(row.hour).padStart(2, "0")}:00 — ${formatHoursMinutes(row.seconds)}`}
                />
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Day of week"
            subtitle={`Heaviest on ${bestWeekday.label} — ${formatHoursMinutes(bestWeekday.seconds)}`}
          />
          <ul className="space-y-2 p-4">
            {byWeekday.map((row) => {
              const max = Math.max(...byWeekday.map((item) => item.seconds), 1);
              return (
                <li key={row.weekday} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-muted-foreground">{row.label.slice(0, 3)}</span>
                  <div className="flex-1">
                    <Progress value={barPercent(row.seconds, max)} tone="accent" />
                  </div>
                  <span className="w-16 shrink-0 text-right text-muted-foreground">{formatHoursMinutes(row.seconds)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="University time vs self-study" subtitle="Kept apart on purpose — class time is never counted as self-study." />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <Label className="mb-0">Self-study</Label>
            <p className="mt-1 text-xl font-semibold">{formatHoursMinutes(academic.selfStudySeconds)}</p>
            <p className="text-[11px] text-muted-foreground">From the study timer</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <Label className="mb-0">Class time</Label>
            <p className="mt-1 text-xl font-semibold">{formatHoursMinutes(academic.classSeconds)}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatHoursMinutes(academic.weeklyClassSeconds)}/week × {academic.weeks} weeks
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <Label className="mb-0">Total academic time</Label>
            <p className="mt-1 text-xl font-semibold">{formatHoursMinutes(academic.selfStudySeconds + academic.classSeconds)}</p>
            <p className="text-[11px] text-muted-foreground">The sum of the two above, nothing merged</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tasks" subtitle={`${taskStats.completedInRange} completed in this window`} />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <MiniStat label="Open" value={String(taskStats.open)} />
            <MiniStat label="Completed" value={String(taskStats.completedInRange)} />
            <MiniStat label="Overdue" value={String(taskStats.overdue)} tone={taskStats.overdue > 0 ? "danger" : undefined} />
            <MiniStat label="All time done" value={String(taskStats.completed)} />
          </div>
          {taskStats.byPriority.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border p-4">
              {taskStats.byPriority.map((row) => (
                <Badge key={row.priority} tone="neutral">
                  {row.priority}: {row.count}
                </Badge>
              ))}
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Reading" subtitle={`${reading.daysRead} days read in this window`} />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <MiniStat label="Pages" value={String(reading.pages)} />
            <MiniStat label="Time" value={formatHoursMinutes(reading.seconds)} />
            <MiniStat label="Books reading" value={String(reading.booksReading)} />
            <MiniStat label="Finished" value={String(reading.booksCompleted)} />
          </div>
          {reading.byBook.length > 0 ? (
            <ul className="space-y-2 border-t border-border p-4">
              {reading.byBook.map((book) => (
                <li key={book.key} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{book.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {book.pages} pages · {formatHoursMinutes(book.seconds)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Skills" subtitle={`${learning.evidence} evidence records · ${learning.evidenceInRange} added in this window`} />
          {learning.skillsByStage.length === 0 ? (
            <EmptyState title="No skills tracked" />
          ) : (
            <ul className="space-y-2 p-4">
              {learning.skillsByStage.map((row) => (
                <li key={row.stage} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium">{STAGE_LABELS[row.stage as MasteryStage] ?? row.stage}</span>
                  <span className="text-muted-foreground">{row.count} skill{row.count === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Knowledge" subtitle="Concepts, notes and open questions" />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <MiniStat label="Concepts" value={String(learning.concepts)} />
            <MiniStat label="Notes" value={String(learning.notes)} />
            <MiniStat label="Open questions" value={String(learning.openQuestions)} tone={learning.openQuestions > 10 ? "warning" : undefined} />
            <MiniStat label="Answered" value={String(learning.answeredQuestions)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Opportunities"
            subtitle={
              opportunities.successRate === null
                ? "No decisions recorded yet, so no success rate is shown"
                : `${opportunities.accepted} accepted of ${opportunities.applied + opportunities.accepted + opportunities.rejected} decided`
            }
          />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
            <MiniStat label="Applied" value={String(opportunities.applied)} />
            <MiniStat label="Accepted" value={String(opportunities.accepted)} />
            <MiniStat label="Rejected" value={String(opportunities.rejected)} />
            <MiniStat label="Success rate" value={opportunities.successRate === null ? "—" : `${opportunities.successRate}%`} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Achievements by year" subtitle="Dated records only — nothing estimated" />
          {achievements.byYear.length === 0 ? (
            <EmptyState title="No achievements recorded" />
          ) : (
            <ul className="space-y-2 p-4">
              {achievements.byYear.map((row) => (
                <li key={row.year} className="flex items-center gap-2 text-xs">
                  <span className="w-12 shrink-0 font-medium">{row.year}</span>
                  <div className="flex-1">
                    <Progress value={row.count} max={Math.max(...achievements.byYear.map((item) => item.count), 1)} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-muted-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Projects" subtitle="Study time and task completion per project, from real records" />
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" />
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((project) => (
              <li key={project.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="text-muted-foreground">
                    {project.tasksDone}/{project.tasksTotal} tasks · {formatHoursMinutes(project.studySeconds)} all time
                    {project.studyInRange > 0 ? ` · ${formatHoursMinutes(project.studyInRange)} in this window` : ""}
                  </p>
                </div>
                <Badge tone="neutral">{project.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="pb-2 text-center text-[11px] text-muted-foreground">
        All figures computed in {timeZone} from your own records at request time.
      </p>
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

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" }) {
  const colour = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="rounded-md border border-border p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${colour}`}>{value}</p>
    </div>
  );
}

function SliceList({ rows, empty }: { rows: Slice[]; empty: string }) {
  if (rows.length === 0) return <EmptyState title={empty} />;
  return (
    <ul className="space-y-2 p-4">
      {rows.map((row) => (
        <li key={row.key} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{row.label}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatHoursMinutes(row.seconds)} · {row.percent}%
            </span>
          </div>
          <Progress value={row.percent} />
        </li>
      ))}
    </ul>
  );
}
