import { requireUser } from "@/server/auth/session";
import { AdvisorClient } from "@/components/advisor/AdvisorClient";
import { ADVISOR_QUESTIONS, advisorHistory, deniedModules, permissionsFor } from "@/server/services/advisor";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const user = await requireUser();
  const [permissions, history] = await Promise.all([permissionsFor(user.id), advisorHistory(user.id)]);

  return (
    <AdvisorClient
      questions={[...ADVISOR_QUESTIONS]}
      history={history}
      denied={deniedModules(permissions)}
      llmConfigured={Boolean(process.env.OPENAI_API_KEY)}
    />
  );
}
