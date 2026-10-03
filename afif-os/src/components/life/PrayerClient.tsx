"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MoonStar } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Label,
  Textarea,
} from "@/components/ui/primitives";
import { logPrayerAction } from "@/server/services/life-actions";
import { PRAYER_LABELS, PRAYER_STATUS_LABELS, PRAYER_STATUS_TONES } from "@/lib/labels";

type DayCell = {
  prayer: keyof typeof PRAYER_LABELS;
  status: keyof typeof PRAYER_STATUS_LABELS | null;
  id: string | null;
};

const STATUSES = Object.keys(PRAYER_STATUS_LABELS) as (keyof typeof PRAYER_STATUS_LABELS)[];

export function PrayerClient({
  day,
  cells,
  streak,
  stats,
  timeZone,
}: {
  day: string;
  cells: DayCell[];
  streak: { current: number; longest: number };
  stats: { days: number; total: number; onTime: number; late: number; missed: number; qada: number; consistency: number | null };
  timeZone: string;
}) {
  const router = useRouter();
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const todayKey = React.useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
    [timeZone],
  );

  const shift = (delta: number) => {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + delta);
    return date.toISOString().slice(0, 10);
  };

  async function log(prayer: DayCell["prayer"], status: keyof typeof PRAYER_STATUS_LABELS) {
    setBusy(`${prayer}-${status}`);
    setError(null);
    const result = await logPrayerAction({ prayer, day, status, notes: notes[prayer] ?? null });
    setBusy(null);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const logged = cells.filter((cell) => cell.status).length;
  const dayLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Streak" value={`${streak.current}d`} hint={`Best: ${streak.longest}d of all five on time or late`} />
        <StatCard label="Logged today" value={`${logged} / ${cells.length}`} hint={day === todayKey ? "Today" : dayLabel} />
        <StatCard
          label={`On time (${stats.days}d)`}
          value={String(stats.onTime)}
          hint={`${stats.late} late · ${stats.qada} qada`}
        />
        <StatCard
          label="Missed"
          value={String(stats.missed)}
          hint={stats.consistency === null ? "Nothing logged yet" : `${stats.consistency}% of logged prayers performed`}
        />
      </div>

      <Card>
        <CardHeader
          title={day === todayKey ? "Today's prayers" : dayLabel}
          subtitle="Logged by you. Nothing here is inferred or back-filled."
          action={
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => router.push(`/life/prayer?day=${shift(-1)}`)} aria-label="Previous day">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => router.push(`/life/prayer?day=${todayKey}`)}>
                Today
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push(`/life/prayer?day=${shift(1)}`)}
                disabled={day >= todayKey}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        />

        {cells.length === 0 ? (
          <EmptyState icon={<MoonStar className="h-8 w-8" />} title="Nothing to log" />
        ) : (
          <ul className="divide-y divide-border">
            {cells.map((cell) => (
              <li key={cell.prayer} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="text-sm font-medium">{PRAYER_LABELS[cell.prayer]}</p>
                  {cell.status ? (
                    <Badge tone={PRAYER_STATUS_TONES[cell.status]}>{PRAYER_STATUS_LABELS[cell.status]}</Badge>
                  ) : (
                    <Badge tone="neutral">Not logged</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => log(cell.prayer, status)}
                      className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                        cell.status === status
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {PRAYER_STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border p-4">
          <Field label="Note for the day" hint="Optional — saved with the next prayer you log">
            <Textarea rows={2} value={notes["*"] ?? ""} onChange={(event) => setNotes({ "*": event.target.value })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <Label className="mb-0">{label}</Label>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
