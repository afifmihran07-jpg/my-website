import Link from "next/link";
import { Check, Clock, GraduationCap, ListTodo, MoonStar, Pill, Sunrise } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { Badge, Card, CardHeader, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { formatHoursMinutes, formatTimeOfDay, relativeTime } from "@/lib/format";
import { todayKey } from "@/server/lib/time";
import { buildNextActions, getToday } from "@/server/services/dashboard";
import { getDaySummary } from "@/server/services/study";
import { db } from "@/server/db";
import { and, eq, inArray } from "drizzle-orm";
import { prayerLogs, books, medications, medicationLogs } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await requireUser();
  const timeZone = user.timezone;
  const dayKey = todayKey(timeZone);
  const now = new Date();

  const [today, day, priorities, prayers, reading, meds, medLogs] = await Promise.all([
    getToday(user.id, dayKey, timeZone, now),
    getDaySummary(user.id, dayKey, timeZone),
    buildNextActions(user.id, dayKey, timeZone, now),
    db
      .select()
      .from(prayerLogs)
      .where(and(eq(prayerLogs.userId, user.id), eq(prayerLogs.day, dayKey))),
    db
      .select()
      .from(books)
      .where(and(eq(books.userId, user.id), eq(books.status, "reading"))),
    db.select().from(medications).where(and(eq(medications.userId, user.id), eq(medications.active, true))),
    db
      .select()
      .from(medicationLogs)
      .where(and(eq(medicationLogs.userId, user.id), inArray(medicationLogs.status, ["pending", "taken"]))),
  ]);

  const prayerNames = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
  const loggedPrayers = new Set(prayers.map((p) => p.prayer));
  const todayMeds = medLogs.filter(
    (log) => log.scheduledAt.toISOString().slice(0, 10) === dayKey,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Top priorities"
          subtitle="The three things that matter most right now"
          icon={<Sunrise className="h-4 w-4" />}
        />
        {priorities.length === 0 ? (
          <EmptyState icon={<Check className="h-8 w-8" />} title="Nothing pressing" description="A rare and good day." />
        ) : (
          <ol className="divide-y divide-border">
            {priorities.slice(0, 3).map((action, index) => (
              <li key={action.id} className="flex gap-3 px-4 py-3">
                <span className="tabular mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{action.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{action.why}</p>
                  <div className="mt-2 flex gap-1.5">
                    {action.actions.map((item) => (
                      <Link
                        key={item.href + item.label}
                        href={item.href}
                        className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium hover:bg-muted"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="University classes"
            subtitle="Scheduled from your timetable"
            icon={<GraduationCap className="h-4 w-4" />}
          />
          {today.classes.length === 0 ? (
            <EmptyState title="No classes today" />
          ) : (
            <ul className="divide-y divide-border">
              {today.classes.map((klass) => (
                <li key={klass.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="tabular w-20 shrink-0 text-xs text-muted-foreground">
                    {formatTimeOfDay(new Date(klass.start), timeZone)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {klass.code ? <strong>{klass.code}</strong> : null} {klass.title}
                  </span>
                  {klass.room ? <Badge tone="neutral">{klass.room}</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Tasks"
            subtitle={`${today.tasks.completedToday} completed · ${today.tasks.overdue} overdue`}
            icon={<ListTodo className="h-4 w-4" />}
            action={
              <Link href="/tasks" className="text-xs text-primary hover:underline">
                All tasks
              </Link>
            }
          />
          {today.tasks.items.length === 0 ? (
            <EmptyState title="Nothing due today" />
          ) : (
            <ul className="divide-y divide-border">
              {today.tasks.items.map((task) => (
                <li key={task.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <Badge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>
                    {task.priority}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Study today" icon={<Clock className="h-4 w-4" />} />
          <div className="px-4 py-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="tabular text-sm font-semibold">{formatHoursMinutes(day.totalSeconds)}</p>
                <p className="text-[10px] text-muted-foreground">Self study</p>
              </div>
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="tabular text-sm font-semibold">{formatHoursMinutes(day.universitySeconds)}</p>
                <p className="text-[10px] text-muted-foreground">Class</p>
              </div>
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="tabular text-sm font-semibold">{formatHoursMinutes(day.totalAcademicSeconds)}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>
            {day.sessions.length > 0 ? (
              <>
                <SectionTitle className="mt-3">Sessions</SectionTitle>
                <ul className="space-y-1">
                  {day.sessions.map((session) => (
                    <li key={session.id} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: session.courseColor ?? "rgb(99 102 241)" }} />
                      <span className="min-w-0 flex-1 truncate">
                        {session.courseCode ? `${session.courseCode}${session.topic ? ` — ${session.topic}` : ""}` : session.title}
                      </span>
                      <span className="tabular text-muted-foreground">{formatHoursMinutes(session.durationSeconds)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">No self-study recorded yet today.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Reading" subtitle="Books you are currently reading" icon={<MoonStar className="h-4 w-4" />} />
          {reading.length === 0 ? (
            <EmptyState title="No book in progress" />
          ) : (
            <ul className="divide-y divide-border">
              {reading.map((book) => {
                const remaining = book.totalPages ? Math.max(0, book.totalPages - book.currentPage) : null;
                return (
                  <li key={book.id} className="px-4 py-2.5 text-sm">
                    <p className="truncate font-medium">{book.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Page {book.currentPage}
                      {book.totalPages ? ` of ${book.totalPages}` : ""}
                      {remaining !== null ? ` · ${remaining} left` : ""}
                      {book.dailyPageTarget ? ` · target ${book.dailyPageTarget}/day` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Prayer" subtitle="Tracking only — no judgements" icon={<MoonStar className="h-4 w-4" />} />
          <ul className="grid grid-cols-5 gap-1.5 px-4 py-3">
            {prayerNames.map((name) => {
              const logged = loggedPrayers.has(name);
              return (
                <li
                  key={name}
                  className={`rounded-lg border px-1 py-2 text-center text-[11px] capitalize ${
                    logged ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted-foreground"
                  }`}
                >
                  {name}
                </li>
              );
            })}
          </ul>
          <p className="px-4 pb-3 text-[11px] text-muted-foreground">
            {loggedPrayers.size} of 5 recorded for {dayKey}. Logging happens on the Prayer page (Phase 7).
          </p>
        </Card>

        <Card>
          <CardHeader title="Medication" subtitle="Reminder schedule for today" icon={<Pill className="h-4 w-4" />} />
          {meds.length === 0 ? (
            <EmptyState title="No active medication" description="Add medication on the Medication page (Phase 7)." />
          ) : (
            <ul className="divide-y divide-border">
              {meds.map((med) => (
                <li key={med.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {med.name}
                    {med.dose ? <span className="text-muted-foreground"> · {med.dose}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{med.times.join(", ") || "no time set"}</span>
                </li>
              ))}
            </ul>
          )}
          {todayMeds.length > 0 ? (
            <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              {todayMeds.filter((l) => l.status === "taken").length} of {todayMeds.length} doses taken today.
            </p>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardHeader title="Reminders today" subtitle="Fired, pending and missed" icon={<Clock className="h-4 w-4" />} />
        {today.reminders.length === 0 ? (
          <EmptyState title="No reminders scheduled for today" />
        ) : (
          <ul className="divide-y divide-border">
            {today.reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{reminder.title}</span>
                <Badge tone={reminder.status === "missed" ? "danger" : reminder.status === "completed" ? "accent" : "neutral"}>
                  {reminder.status}
                </Badge>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {relativeTime(new Date(reminder.remindAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
