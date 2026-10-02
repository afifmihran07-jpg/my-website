import { Suspense } from "react";

import { requireUser } from "@/server/auth/session";
import { OpportunitiesClient } from "@/components/opportunities/OpportunitiesClient";
import { listOpportunities, opportunityStats } from "@/server/services/opportunities";
import { serializeOpportunity } from "@/server/services/opportunities-validation";
import { Skeleton } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const user = await requireUser();

  const [opportunities, stats] = await Promise.all([listOpportunities(user.id), opportunityStats(user.id)]);

  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <OpportunitiesClient
        opportunities={opportunities.map(serializeOpportunity)}
        stats={stats}
        timeZone={user.timezone}
      />
    </Suspense>
  );
}
