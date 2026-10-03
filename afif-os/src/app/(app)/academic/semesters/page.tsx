import { requireUser } from "@/server/auth/session";
import { SemestersClient } from "@/components/academic/SemestersClient";
import { listSemestersWithStats } from "@/server/services/academic";

export const dynamic = "force-dynamic";

export default async function SemestersPage() {
  const user = await requireUser();
  const rows = await listSemestersWithStats(user.id);
  return <SemestersClient rows={rows} />;
}
