import { requireUser } from "@/server/auth/session";
import { ActivitiesClient } from "@/components/life/ActivitiesClient";
import { activitySummary, listActivities } from "@/server/services/life";
import { serializeActivity } from "@/server/services/life-validation";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const user = await requireUser();

  const [activities, summary] = await Promise.all([
    listActivities(user.id),
    activitySummary(user.id, new Date(Date.now() - 7 * 86_400_000), new Date()),
  ]);

  return <ActivitiesClient activities={activities.map(serializeActivity)} summary={summary} timeZone={user.timezone} />;
}
