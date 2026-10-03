import { requireUser } from "@/server/auth/session";
import { DashboardView } from "@/components/dashboard/DashboardView";
import {
  buildNextActions,
  getCurrentState,
  getToday,
  upcomingDeadlines,
} from "@/server/services/dashboard";
import { getDaySummary, getWeekSummary } from "@/server/services/study";
import { unreadNotificationCount, runReminderTick } from "@/server/services/reminders";
import { localHour, todayKey } from "@/server/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const timeZone = user.timezone;
  const now = new Date();
  const dayKey = todayKey(timeZone, now);

  // The engine runs wherever the app is used; a dedicated cron can also call it.
  await runReminderTick(now).catch((error) => {
    console.error("[afif-os] reminder tick failed:", error instanceof Error ? error.message : error);
  });

  const [state, today, nextActions, day, week, deadlines, unread] = await Promise.all([
    getCurrentState(user.id, dayKey, timeZone),
    getToday(user.id, dayKey, timeZone, now),
    buildNextActions(user.id, dayKey, timeZone, now),
    getDaySummary(user.id, dayKey, timeZone),
    getWeekSummary(user.id, dayKey, timeZone, user.weekStartsOn),
    upcomingDeadlines(user.id, dayKey, 14),
    unreadNotificationCount(user.id),
  ]);

  const hour = localHour(now, timeZone);

  return (
    <DashboardView
      timeZone={timeZone}
      dayKey={dayKey}
      greetingHour={hour}
      firstName={user.fullName.split(" ")[0] ?? user.fullName}
      unreadCount={unread}
      state={state}
      today={{
        classes: today.classes.map((c) => ({
          id: c.id,
          title: c.title,
          code: c.code,
          room: c.room,
          start: c.start.toISOString(),
          end: c.end.toISOString(),
        })),
        tasks: today.tasks,
        reminders: today.reminders,
      }}
      deadlines={deadlines.slice(0, 6)}
      nextActions={nextActions}
      study={{
        totalSeconds: day.totalSeconds,
        universitySeconds: day.universitySeconds,
        sessionCount: day.sessionCount,
        sessions: day.sessions.slice(0, 6).map((s) => ({
          id: s.id,
          title: s.title,
          topic: s.topic,
          courseCode: s.courseCode,
          courseName: s.courseName,
          color: s.courseColor,
          durationSeconds: s.durationSeconds,
          startedAt: s.startedAt.toISOString(),
        })),
        byCourse: day.byCourse.slice(0, 5).map((slice) => ({
          label: slice.label,
          seconds: slice.seconds,
          color: slice.color,
        })),
        weekTotalSeconds: week.totalSeconds,
        weekPerDay: week.perDay,
        weekActiveDays: week.activeDays,
      }}
    />
  );
}
