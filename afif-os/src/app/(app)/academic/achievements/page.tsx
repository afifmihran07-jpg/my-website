import { requireUser } from "@/server/auth/session";
import { AchievementsClient } from "@/components/achievements/AchievementsClient";
import {
  achievementStats,
  achievementsByYear,
  courseOptions,
  listCertificates,
  skillOptions,
} from "@/server/services/achievements";
import { serializeAchievement, serializeCertificate } from "@/server/services/achievements-validation";
import { projectOptions } from "@/server/services/projects";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const user = await requireUser();

  const [groups, stats, certificates, projects, skills, courses] = await Promise.all([
    achievementsByYear(user.id),
    achievementStats(user.id),
    listCertificates(user.id),
    projectOptions(user.id),
    skillOptions(user.id),
    courseOptions(user.id),
  ]);

  return (
    <AchievementsClient
      groups={groups.map((group) => ({ year: group.year, items: group.items.map(serializeAchievement) }))}
      stats={stats}
      certificates={certificates.map(serializeCertificate)}
      projects={projects}
      skills={skills}
      courses={courses}
      timeZone={user.timezone}
    />
  );
}
