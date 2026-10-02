import Link from "next/link";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { Badge, Card, CardHeader, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { barPercent, formatHoursMinutes, hourLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { shiftDayKey, todayKey } from "@/server/lib/time";
import { getDaySummary, getMonthSummary, getTimeline, getWeekSummary } from "@/server/services/study";

export const dynamic = "force-dynamic";

export default async function StudyHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayKey(user.timezone);
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? (params.date as string) : today;

  const [day, timeline, week, month] = await Promise.all([
    getDaySummary(user.id, dayKey, user.timezone),
    getTimeline(user.id, dayKey, user.timezone),
    getWeekSummary(user.id, dayKey, user.timezone, user.weekStartsOn),
    getMonthSummary(user.id, dayKey, user.timezone),
  ]);

  const peakHour = Math.max(1, ...hourBuckets(timeline).map((b) => b.seconds));
  const weekdayName = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${dayKey}T00:00:00Z`),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold capitalize">
            {weekdayName}, {dayKey}
          </p>
          <p className="text-xs text-muted-foreground">
            {dayKey === today ? "Today" : dayKey === shiftDayKey(today, -1) ? "Yesterday" : `${daysAgo(dayKey, today)} days ago`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <NavButton href={`/study/history?date=${shiftDayKey(dayKey, -1)}`} label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </NavButton>
          <Link
            href="/study/history"
            className={cn(
              "h-9 rounded-lg border px-3 text-xs font-medium transition-colors",
              dayKey === today ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:bg-muted",
            )}
          >
            Today
          </Link>
          <NavButton href={`/study/history?date=${shiftDayKey(dayKey, 1)}`} label="Next day" disabled={dayKey >= today}>
            <ChevronRight className="h-4 w-4" />
          </NavButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TotalCard label="Self study" value={formatHoursMinutes(day.totalSeconds)} hint={`${day.sessionCount} sessions`} tone="primary" />
        <TotalCard label="University classes" value={formatHoursMinutes(day.universitySeconds)} hint="From your timetable" tone="muted" />
        <TotalCard
          label="Total academic time"
          value={formatHoursMinutes(day.totalAcademicSeconds)}
          hint={`Average session ${formatHoursMinutes(day.averageSeconds)}`}
          tone="accent"
        />
      </div>

      <Card>
        <CardHeader title="24-hour timeline" subtitle="When you actually studied" icon={<History className="h-4 w-4" />} />
        <div className="px-4 py-4">
          {timeline.length === 0 ? (
            <EmptyState title="No study recorded on this day" description="Start a session from the Study Timer." />
          ) : (
            <div className="space-y-1">
              {hourBuckets(timeline)
                .filter((bucket) => bucket.seconds > 0)
                .map((bucket) => (
                  <div key={bucket.hour} className="flex items-center gap-3">
                    <span className="tabular w-12 shrink-0 text-[11px] text-muted-foreground">{hourLabel(bucket.hour)}</span>
                    <div className="flex h-6 flex-1 items-center gap-1 overflow-hidden">
                      {bucket.items.map((item) => (
                        <div
                          key={item.key}
                          title={`${item.label} · ${formatHoursMinutes(item.seconds)}`}
                          className="h-full rounded-sm"
                          style={{
                            width: `${Math.max(2, barPercent(item.seconds, peakHour))}%`,
                            backgroundColor: item.color ?? "rgb(99 102 241)",
                            opacity: 0.85,
                          }}
                        />
                      ))}
                    </div>
                    <span className="tabular w-14 shrink-0 text-right text-[11px] text-muted-foreground">
                      {formatHoursMinutes(bucket.seconds)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sessions" subtitle={`${day.sessionCount} recorded on ${dayKey}`} />
          {day.sessions.length === 0 ? (
            <EmptyState title="Nothing here yet" />
          ) : (
            <ul className="divide-y divide-border">
              {day.sessions.map((session) => (
                <li key={session.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: session.courseColor ?? "rgb(99 102 241)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {session.courseCode ? `${session.courseCode}${session.topic ? ` — ${session.topic}` : ""}` : session.title}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: user.timezone }).format(session.startedAt)}
                      {session.endedAt
                        ? ` → ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: user.timezone }).format(session.endedAt)}`
                        : ""}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xs font-medium">{formatHoursMinutes(session.durationSeconds)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Subject distribution" subtitle="This day" />
            {day.byCourse.length === 0 ? (
              <EmptyState title="No subjects recorded" />
            ) : (
              <ul className="space-y-2 px-4 py-3">
                {day.byCourse.map((slice) => (
                  <li key={slice.label} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                      <span className="tabular shrink-0 text-muted-foreground">{formatHoursMinutes(slice.seconds)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${barPercent(slice.seconds, day.totalSeconds)}%`,
                          backgroundColor: slice.color ?? "rgb(99 102 241)",
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Weekly trend"
              subtitle={`${week.activeDays}/7 active days · longest session ${formatHoursMinutes(week.longestSeconds)}`}
            />
            <div className="flex h-24 items-end gap-1.5 px-4 py-4">
              {week.perDay.map((entry) => {
                const peak = Math.max(1, ...week.perDay.map((d) => d.seconds));
                return (
                  <div key={entry.dayKey} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end rounded bg-muted">
                      <div
                        className={cn("w-full rounded", entry.dayKey === dayKey ? "bg-primary" : "bg-primary/50")}
                        style={{ height: `${Math.max(entry.seconds > 0 ? 6 : 0, barPercent(entry.seconds, peak))}%` }}
                        title={`${entry.dayKey}: ${formatHoursMinutes(entry.seconds)}`}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">{entry.dayKey.slice(8)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border px-4 py-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Week total</span>
                <span className="tabular font-semibold">{formatHoursMinutes(week.totalSeconds)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Average per day</span>
                <span className="tabular font-semibold">{formatHoursMinutes(week.averageSecondsPerDay)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Monthly consistency"
              subtitle={`${month.activeDays} active days · ${month.sessionCount} sessions`}
            />
            <div className="px-4 py-3">
              <SectionTitle>Course distribution this month</SectionTitle>
              {month.byCourse.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing recorded this month.</p>
              ) : (
                <ul className="space-y-1.5">
                  {month.byCourse.slice(0, 6).map((slice) => (
                    <li key={slice.label} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color ?? "rgb(99 102 241)" }} />
                      <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                      <span className="tabular shrink-0 text-muted-foreground">{formatHoursMinutes(slice.seconds)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Month total</span>
                <Badge tone="primary">{formatHoursMinutes(month.totalSeconds)}</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function NavButton({
  href,
  label,
  disabled,
  children,
}: {
  href: string;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground/40" aria-disabled>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className="grid h-9 w-9 place-items-center rounded-lg border border-border transition-colors hover:bg-muted">
      {children}
    </Link>
  );
}

function TotalCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "primary" | "muted" | "accent" }) {
  const accent = { primary: "text-primary", muted: "text-muted-foreground", accent: "text-accent" }[tone];
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("tabular mt-1 text-2xl font-semibold tracking-tight", accent)}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  );
}

type HourBucket = { hour: number; seconds: number; items: Array<{ key: string; label: string; seconds: number; color: string | null }> };

function hourBuckets(
  timeline: Array<{ sessionId: string; label: string; color: string | null; startHour: number; startMinute: number; endHour: number; endMinute: number; seconds: number }>,
): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, seconds: 0, items: [] }));
  for (const segment of timeline) {
    const bucket = buckets[segment.startHour];
    if (!bucket) continue;
    bucket.seconds += segment.seconds;
    bucket.items.push({
      key: `${segment.sessionId}-${segment.startHour}`,
      label: segment.label,
      seconds: segment.seconds,
      color: segment.color,
    });
  }
  return buckets;
}

function daysAgo(dayKey: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dayKey}T00:00:00Z`)) / 86_400_000);
}
