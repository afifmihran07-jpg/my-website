import { requireUser } from "@/server/auth/session";
import { SkillsClient } from "@/components/skills/SkillsClient";
import { domainOptions } from "@/server/services/books";
import { listSkills } from "@/server/services/learning";
import { serializeSkill } from "@/server/services/learning-validation";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const user = await requireUser();

  const [skills, domains] = await Promise.all([listSkills(user.id), domainOptions(user.id)]);

  return <SkillsClient skills={skills.map(serializeSkill)} domains={domains} timeZone={user.timezone} />;
}
