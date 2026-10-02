import { requireUser } from "@/server/auth/session";
import { MedicationClient } from "@/components/life/MedicationClient";
import { dosesDueToday, listMedications, medicationAdherence } from "@/server/services/life";
import { serializeMedication } from "@/server/services/life-validation";
import { todayKey } from "@/server/lib/time";

export const dynamic = "force-dynamic";

export default async function MedicationPage() {
  const user = await requireUser();
  const day = todayKey(user.timezone);

  const [medications, doses, adherence] = await Promise.all([
    listMedications(user.id, day),
    dosesDueToday(user.id, day),
    medicationAdherence(user.id, 7),
  ]);

  return (
    <MedicationClient
      medications={medications.map(serializeMedication)}
      doses={doses.map((dose) => ({
        medicationId: dose.medicationId,
        name: dose.name,
        dose: dose.dose,
        time: dose.time,
        scheduledAt: dose.scheduledAt.toISOString(),
        status: dose.status,
      }))}
      adherence={adherence}
      timeZone={user.timezone}
    />
  );
}
