import { requireUser } from "@/server/auth/session";
import { AnalyticsClient } from "@/components/analytics/AnalyticsClient";
import {
  academicTimeSplit,
  achievementAnalytics,
  learningAnalytics,
  opportunityAnalytics,
  projectAnalytics,
  readingAnalytics,
  studyByHour,
  studyByWeekday,
  studyDistribution,
  studyTotals,
  studyTrend,
  taskAnalytics,
  type Range,
} from "@/server/services/analytics";

export const dynamic = "force-dynamic";

const VALID: Range[] = [7, 30, 90, 365];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const requested = Number(params.range);
  const range: Range = VALID.includes(requested as Range) ? (requested as Range) : 30;

  const [
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
  ] = await Promise.all([
    studyTotals(user.id, range, user.timezone),
    studyTrend(user.id, range, user.timezone),
    studyDistribution(user.id, range),
    studyByHour(user.id, range, user.timezone),
    studyByWeekday(user.id, range, user.timezone),
    taskAnalytics(user.id, range, user.timezone),
    readingAnalytics(user.id, range, user.timezone),
    learningAnalytics(user.id, range),
    opportunityAnalytics(user.id),
    projectAnalytics(user.id, range),
    achievementAnalytics(user.id),
    academicTimeSplit(user.id, range),
  ]);

  return (
    <AnalyticsClient
      range={range}
      totals={totals}
      trend={trend}
      distribution={distribution}
      byHour={byHour}
      byWeekday={byWeekday}
      taskStats={taskStats}
      reading={reading}
      learning={learning}
      opportunities={opportunities}
      projects={projects}
      achievements={achievements}
      academic={academic}
      timeZone={user.timezone}
    />
  );
}
