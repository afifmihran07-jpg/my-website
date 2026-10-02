import { requireUser } from "@/server/auth/session";
import { PolymathClient } from "@/components/polymath/PolymathClient";
import { learningStats, linkOptions, listConcepts, listConnections, listDomains } from "@/server/services/learning";
import { serializeConcept, serializeConnection, serializeDomain } from "@/server/services/learning-validation";

export const dynamic = "force-dynamic";

export default async function PolymathPage() {
  const user = await requireUser();

  const [domains, concepts, connections, stats, options] = await Promise.all([
    listDomains(user.id),
    listConcepts(user.id),
    listConnections(user.id),
    learningStats(user.id),
    linkOptions(user.id),
  ]);

  return (
    <PolymathClient
      domains={domains.map(serializeDomain)}
      concepts={concepts.map(serializeConcept)}
      connections={connections.map(serializeConnection)}
      stats={stats}
      linkOptions={options}
    />
  );
}
