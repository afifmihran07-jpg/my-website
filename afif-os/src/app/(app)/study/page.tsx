import { requireUser } from "@/server/auth/session";
import { StudyTimerPage } from "@/components/study/StudyTimerPage";
import { getOptionsAction } from "@/server/services/options-actions";
import { getRunningStudy, toStudyDto } from "@/server/services/study";
import { getDaySummary } from "@/server/services/study";
import { todayKey } from "@/server/lib/time";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  const user = await requireUser();
  const dayKey = todayKey(user.timezone);
  const [optionsResult, running, day] = await Promise.all([
    getOptionsAction(),
    getRunningStudy(user.id),
    getDaySummary(user.id, dayKey, user.timezone),
  ]);

  return (
    <StudyTimerPage
      timeZone={user.timezone}
      initialSession={running ? toStudyDto(running) : null}
      options={optionsResult.ok ? optionsResult.data : { courses: [], books: [], projects: [], goals: [] }}
      today={{
        totalSeconds: day.totalSeconds,
        universitySeconds: day.universitySeconds,
        sessionCount: day.sessionCount,
        sessions: day.sessions.map((session) => ({
          id: session.id,
          title: session.title,
          topic: session.topic,
          courseCode: session.courseCode,
          durationSeconds: session.durationSeconds,
        })),
      }}
    />
  );
}
