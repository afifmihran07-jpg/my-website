import Link from "next/link";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { CalendarDays, Check } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatHoursMinutes, formatTimeOfDay, barPercent } from "@/lib/format";
import { dayRange, monthRange, shiftDayKey, toLocalDayKey, todayKey, weekdayOfKey } from "@/server/lib/time";
import { db } from "@/server/db";
import { achievements, calendarEvents, classSchedules, diaryEntries, photos, tasks } from "@/server/db/schema";
import { getDaySummary, getTimeline } from "@/server/services/study";
import { getTaskBuckets } from "@/server/services/tasks";
import { todayClasses } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

type DayCell = {
  dayKey: string;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  classes: number;
  events: number;
  tasksDue: number;
  studySeconds: number;
  completed: number;
  selected: boolean;
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const timeZone = user.timezone;
  const params = await searchParams;
  const today = todayKey(timeZone, new Date());
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? (params.date as string) : today;
  const month = monthRange(anchor, timeZone);

  const [events, dueTasks, completedTasks, schedules, achievementsInMonth] = await Promise.all([
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, user.id),
          isNull(calendarEvents.archivedAt),
          gte(calendarEvents.startsAt, month.start),
          lt(calendarEvents.startsAt, month.end),
        ),
      ),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          isNull(tasks.archivedAt),
          sql`${tasks.dueDate} is not null and ${tasks.dueDate} >= ${month.first} and ${tasks.dueDate} < ${month.last}`,
        ),
      ),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.status, "completed"),
          gte(tasks.completedAt, month.start),
          lt(tasks.completedAt, month.end),
        ),
      ),
    db
      .select()
      .from(classSchedules)
      .where(and(eq(classSchedules.userId, user.id), eq(classSchedules.active, true))),
    db
      .select()
      .from(achievements)
      .where(
        and(
          eq(achievements.userId, user.id),
          sql`${achievements.occurredOn} >= ${month.first} and ${achievements.occurredOn} < ${month.last}`,
        ),
      ),
  ]);

  const studyByDay = new Map<string, number>();
  const monthSummary = await getMonthStudy(user.id, month.first, month.last, timeZone);
  for (const entry of monthSummary) studyByDay.set(entry.dayKey, entry.seconds);

  const completedByDay = new Map<string, number>();
  for (const task of completedTasks) {
    if (!task.completedAt) continue;
    const key = toLocalDayKey(task.completedAt, timeZone);
    completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
  }

  const eventsByDay = new Map<string, number>();
  for (const event of events) {
    const key = toLocalDayKey(event.startsAt, timeZone);
    eventsByDay.set(key, (eventsByDay.get(key) ?? 0) + 1);
  }

  const dueByDay = new Map<string, number>();
  for (const task of dueTasks) {
    if (!task.dueDate) continue;
    dueByDay.set(task.dueDate, (dueByDay.get(task.dueDate) ?? 0) + 1);
  }

  const scheduleDays = new Set(schedules.map((s) => s.dayOfWeek));

  const gridStart = shiftDayKey(month.first, -((weekdayOfKey(month.first) - user.weekStartsOn + 7) % 7));
  const cells: DayCell[] = Array.from({ length: 42 }, (_, index) => {
    const dayKey = shiftDayKey(gridStart, index);
    return {
      dayKey,
      inMonth: dayKey >= month.first && dayKey < month.last,
      isToday: dayKey === today,
      isFuture: dayKey > today,
      classes: scheduleDays.has(weekdayOfKey(dayKey)) ? 1 : 0,
      events: eventsByDay.get(dayKey) ?? 0,
      tasksDue: dueByDay.get(dayKey) ?? 0,
      studySeconds: studyByDay.get(dayKey) ?? 0,
      completed: completedByDay.get(dayKey) ?? 0,
      selected: dayKey === anchor,
    };
  });

  const dayDetail = await buildDayDetail(user.id, anchor, timeZone, user.weekStartsOn);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
              new Date(`${month.first}T00:00:00Z`),
            )}
          </p>
          <p className="text-xs text-muted-foreground">Classes, deadlines, study and events in one view</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/calendar?date=${previousMonthKey(month.first)}`}
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
          >
            Previous
          </Link>
          <Link href="/calendar" className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted">
            This month
          </Link>
          <Link
            href={`/calendar?date=${month.last}`}
            className="h-9 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted"
          >
            Next
          </Link>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-7 border-b border-border text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {weekHeader(user.weekStartsOn).map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => (
            <Link
              key={cell.dayKey}
              href={`/calendar?date=${cell.dayKey}`}
              className={cn(
                "min-h-[86px] border-b border-r border-border p-1.5 transition-colors last:border-r-0 hover:bg-muted/50",
                !cell.inMonth && "opacity-40",
                cell.selected && "bg-primary/8",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "tabular grid h-6 w-6 place-items-center rounded-full text-xs",
                    cell.isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {Number(cell.dayKey.slice(8))}
                </span>
                {cell.studySeconds > 0 ? (
                  <span className="tabular text-[9px] text-accent">{formatHoursMinutes(cell.studySeconds)}</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {cell.classes > 0 ? <Dot tone="primary" label="class" /> : null}
                {cell.events > 0 ? <Dot tone="warning" label={`${cell.events} events`} /> : null}
                {cell.tasksDue > 0 ? <Dot tone="danger" label={`${cell.tasksDue} due`} /> : null}
                {cell.completed > 0 ? <Dot tone="accent" label={`${cell.completed} done`} /> : null}
              </div>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <Legend color="bg-primary" label="Class" />
          <Legend color="bg-warning" label="Event" />
          <Legend color="bg-danger" label="Task due" />
          <Legend color="bg-accent" label="Completed / study" />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`What happened on ${anchor}?`}
          subtitle={anchor === today ? "Today" : anchor}
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
          <Section label="Classes" items={dayDetail.classes.map((c) => `${formatTimeOfDay(c.start, timeZone)} · ${c.code ? `${c.code} — ` : ""}${c.title}`)} />
          <Section
            label="Study sessions"
            items={dayDetail.studySessions.map((s) => `${formatHoursMinutes(s.durationSeconds)} · ${s.label}`)}
            empty="No self-study recorded."
          />
          <Section label="Completed tasks" items={dayDetail.completedTasks} empty="Nothing completed." />
          <Section label="Tasks due" items={dayDetail.dueTasks} empty="Nothing due." />
          <Section label="Events" items={dayDetail.events} empty="No events." />
          <Section label="Achievements" items={dayDetail.achievements} empty="None recorded." />
          <Section label="Diary" items={dayDetail.diary} empty="No entry." />
          <Section label="Photos" items={dayDetail.photos} empty="No photos." />
        </div>
        {dayDetail.timeline.length > 0 ? (
          <div className="border-t border-border px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Day timeline ({formatHoursMinutes(dayDetail.studySeconds)} self-study ·{" "}
              {formatHoursMinutes(dayDetail.universitySeconds)} class)
            </p>
            <div className="relative h-8 overflow-hidden rounded bg-muted">
              {dayDetail.timeline.map((segment) => (
                <div
                  key={segment.sessionId + segment.startHour}
                  title={`${segment.label} ${formatHoursMinutes(segment.seconds)}`}
                  style={{
                    width: `${barPercent(segment.seconds, 86400, 2)}%`,
                    marginLeft: `${barPercent(segment.startHour * 60 + segment.startMinute, 1440, 2)}%`,
                    position: "absolute",
                    backgroundColor: segment.color ?? "rgb(99 102 241)",
                    height: "100%",
                  }}
                />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Bars are positioned by time of day, 00:00 → 24:00.</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/** Self-study seconds per local day, aggregated in SQL so a month stays cheap. */
async function getMonthStudy(userId: string, first: string, last: string, timeZone: string) {
  const grouped = await db.execute(sql`
    select to_char(date_trunc('day', started_at at time zone ${timeZone}), 'YYYY-MM-DD') as day_key,
           coalesce(sum(duration_seconds), 0)::int as seconds
    from study_sessions
    where user_id = ${userId}
      and status = 'completed'
      and started_at >= ${new Date(`${first}T00:00:00Z`).toISOString()}::timestamptz
      and started_at < ${new Date(`${last}T00:00:00Z`).toISOString()}::timestamptz
    group by 1
  `);
  const rows = (grouped as unknown as Array<{ day_key: string; seconds: number }>) ?? [];
  return rows.map((row) => ({ dayKey: row.day_key, seconds: Number(row.seconds) }));
}

async function buildDayDetail(userId: string, dayKey: string, timeZone: string, weekStartsOn: number) {
  const range = dayRange(dayKey, timeZone);
  const [day, timeline, buckets, classes, events, achievementsRows, diaryRows, photoRows] = await Promise.all([
    getDaySummary(userId, dayKey, timeZone),
    getTimeline(userId, dayKey, timeZone),
    getTaskBuckets(userId, timeZone, new Date(`${dayKey}T12:00:00Z`)),
    todayClasses(userId, dayKey, timeZone),
    db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, userId),
          isNull(calendarEvents.archivedAt),
          gte(calendarEvents.startsAt, range.start),
          lt(calendarEvents.startsAt, range.end),
        ),
      ),
    db.select().from(achievements).where(and(eq(achievements.userId, userId), eq(achievements.occurredOn, dayKey))),
    db.select().from(diaryEntries).where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.day, dayKey))),
    db
      .select({ id: photos.id, caption: photos.caption })
      .from(photos)
      .where(and(eq(photos.userId, userId), sql`${photos.createdAt}::date = ${dayKey}`)),
  ]);

  void buckets;
  void weekStartsOn;

  const completedTasks = await db
    .select({ title: tasks.title })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.status, "completed"),
        gte(tasks.completedAt, range.start),
        lt(tasks.completedAt, range.end),
      ),
    );

  const dueTasks = await db
    .select({ title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.dueDate, dayKey), isNull(tasks.archivedAt)));

  return {
    classes,
    timeline,
    studySeconds: day.totalSeconds,
    universitySeconds: day.universitySeconds,
    studySessions: day.sessions.map((s) => ({
      durationSeconds: s.durationSeconds,
      label: s.courseCode ? `${s.courseCode}${s.topic ? ` — ${s.topic}` : ""}` : s.title,
    })),
    completedTasks: completedTasks.map((t) => t.title),
    dueTasks: dueTasks.map((t) => t.title),
    events: events.map((e) => `${e.kind} · ${e.title}`),
    achievements: achievementsRows.map((a) => `${a.title} (${a.category})`),
    diary: diaryRows.map((d) => (d.body.length > 90 ? `${d.body.slice(0, 90)}…` : d.body)),
    photos: photoRows.map((p) => p.caption ?? "Untitled photo"),
  };
}

function previousMonthKey(first: string): string {
  const [y, m] = first.split("-").map(Number) as [number, number];
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function weekHeader(weekStartsOn: number): string[] {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: 7 }, (_, i) => labels[(i + weekStartsOn) % 7] ?? "");
}

function Dot({ tone, label }: { tone: "primary" | "warning" | "danger" | "accent"; label: string }) {
  const color = { primary: "bg-primary", warning: "bg-warning", danger: "bg-danger", accent: "bg-accent" }[tone];
  return (
    <span className="flex items-center gap-1 rounded px-1 py-px text-[9px] text-muted-foreground">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function Section({ label, items, empty }: { label: string; items: string[]; empty?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{empty ?? "Nothing."}</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {items.map((item, index) => (
            <li key={`${label}-${index}`} className="flex items-start gap-1.5 text-xs">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
