import { requireUser } from "@/server/auth/session";
import { PrayerClient } from "@/components/life/PrayerClient";
import { prayerDay, prayerStats, prayerStreak } from "@/server/services/life";
import { todayKey } from "@/server/lib/time";

export const dynamic = "force-dynamic";

export default async function PrayerPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const today = todayKey(user.timezone);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? "") ? (params.day as string) : today;

  const [cells, streak, stats] = await Promise.all([
    prayerDay(user.id, day),
    prayerStreak(user.id, today),
    prayerStats(user.id, 30),
  ]);

  return (
    <PrayerClient
      day={day}
      cells={cells.map((cell) => ({ prayer: cell.prayer, status: cell.status, id: cell.id }))}
      streak={streak}
      stats={stats}
      timeZone={user.timezone}
    />
  );
}
