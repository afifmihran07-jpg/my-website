import { requireUser } from "@/server/auth/session";
import { DiaryClient } from "@/components/life/DiaryClient";
import { getDiaryEntry, listDiary } from "@/server/services/life";
import { serializeDiary } from "@/server/services/life-validation";
import { todayKey } from "@/server/lib/time";

export const dynamic = "force-dynamic";

export default async function DiaryPage() {
  const user = await requireUser();
  const day = todayKey(user.timezone);

  const [entries, todayEntry] = await Promise.all([listDiary(user.id), getDiaryEntry(user.id, day)]);

  return (
    <DiaryClient
      entries={entries.map(serializeDiary)}
      todayEntry={todayEntry ? serializeDiary(todayEntry) : null}
      todayKey={day}
      timeZone={user.timezone}
    />
  );
}
