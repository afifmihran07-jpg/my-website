import { requireUser } from "@/server/auth/session";
import { TimelineClient } from "@/components/life/TimelineClient";
import { listMilestones, listReflections, listTimeline } from "@/server/services/life";
import { serializeMilestone, serializeReflection, serializeTimeline } from "@/server/services/life-validation";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const user = await requireUser();

  const [events, milestones, reflections] = await Promise.all([
    listTimeline(user.id),
    listMilestones(user.id),
    listReflections(user.id),
  ]);

  return (
    <TimelineClient
      events={events.map(serializeTimeline)}
      milestones={milestones.map(serializeMilestone)}
      reflections={reflections.map(serializeReflection)}
      timeZone={user.timezone}
    />
  );
}
