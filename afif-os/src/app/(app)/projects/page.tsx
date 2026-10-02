import { requireUser } from "@/server/auth/session";
import { ProjectsClient } from "@/components/projects/ProjectsClient";
import { goalOptions, listProjects, projectSummary } from "@/server/services/projects";
import { serializeProject } from "@/server/services/projects-validation";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();

  const [projects, summary, goals] = await Promise.all([
    listProjects(user.id),
    projectSummary(user.id),
    goalOptions(user.id),
  ]);

  return (
    <ProjectsClient
      projects={projects.map(serializeProject)}
      summary={summary}
      goals={goals.map((goal) => ({ id: goal.id, title: goal.title }))}
      timeZone={user.timezone}
    />
  );
}
