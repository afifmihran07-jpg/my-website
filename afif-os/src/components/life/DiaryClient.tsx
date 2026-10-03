"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, NotebookPen, ShieldCheck } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { formatShortDate } from "@/lib/format";
import { archiveDiaryAction, saveDiaryAction } from "@/server/services/life-actions";
import { MOOD_LABELS } from "@/lib/labels";
import type { SerializedDiaryEntry } from "@/server/services/life-validation";

export function DiaryClient({
  entries,
  todayEntry,
  todayKey,
  timeZone,
}: {
  entries: SerializedDiaryEntry[];
  todayEntry: SerializedDiaryEntry | null;
  todayKey: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [day, setDay] = React.useState(todayEntry?.day ?? todayKey);
  const [body, setBody] = React.useState(todayEntry?.body ?? "");
  const [mood, setMood] = React.useState(todayEntry?.mood ? String(todayEntry.mood) : "");
  const [tags, setTags] = React.useState(todayEntry?.tags.join(", ") ?? "");
  const [aiAllowed, setAiAllowed] = React.useState(todayEntry?.aiAllowed ?? false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const isToday = day === todayKey;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await saveDiaryAction({
      day,
      body,
      mood: mood || null,
      tags,
      aiAllowed,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function archive(entry: SerializedDiaryEntry) {
    setBusy(true);
    const result = await archiveDiaryAction(entry.id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  function load(entry: SerializedDiaryEntry) {
    setDay(entry.day);
    setBody(entry.body);
    setMood(entry.mood ? String(entry.mood) : "");
    setTags(entry.tags.join(", "));
    setAiAllowed(entry.aiAllowed);
    setSaved(false);
  }

  function startNew() {
    setDay(todayKey);
    setBody("");
    setMood("");
    setTags("");
    setAiAllowed(false);
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      {error ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <Alert variant={aiAllowed ? "warning" : "info"} title={aiAllowed ? "This entry is readable by the AI advisor" : "Private by default"}>
        {aiAllowed
          ? "You have explicitly allowed the AI advisor to read this entry. Turn it off to withdraw that access."
          : "The diary is closed to the AI advisor unless you switch it on per entry. Nothing else in the system can read it either."}
      </Alert>

      <Card>
        <CardHeader
          title={isToday ? "Today's entry" : `Entry for ${formatShortDate(day, timeZone)}`}
          subtitle="One entry per day — saving again updates it rather than creating a second one."
          action={
            !isToday ? (
              <Button size="sm" variant="secondary" onClick={startNew}>
                Write today
              </Button>
            ) : null
          }
        />
        <div className="space-y-3 p-4">
          {saved ? <Alert variant="success">Saved.</Alert> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <Input type="date" value={day} max={todayKey} onChange={(event) => setDay(event.target.value)} />
            </Field>
            <Field label="Mood" hint="Optional">
              <Select value={mood} onChange={(event) => setMood(event.target.value)}>
                <option value="">Not recorded</option>
                {Object.entries(MOOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Entry" required>
            <Textarea
              rows={12}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What happened today, and what did it make you think?"
            />
          </Field>

          <Field label="Tags" hint="Comma separated">
            <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="exam, family" />
          </Field>

          <label className="flex items-start gap-2 rounded-md border border-border p-3 text-xs">
            <input
              type="checkbox"
              checked={aiAllowed}
              onChange={(event) => setAiAllowed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border bg-background"
            />
            <span>
              {aiAllowed ? (
                <>
                  <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                  The AI advisor may read this specific entry.
                </>
              ) : (
                <>
                  <Lock className="mr-1 inline h-3.5 w-3.5" />
                  The AI advisor cannot read this entry.
                </>
              )}
            </span>
          </label>

          <div className="flex justify-end">
            <Button onClick={save} loading={busy} disabled={!body.trim()}>
              Save entry
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Past entries" subtitle={`${entries.length} saved · click one to open it`} />
        {entries.length === 0 ? (
          <EmptyState icon={<NotebookPen className="h-8 w-8" />} title="No entries yet" description="Your first entry appears here once you save it." />
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => load(entry)} className="w-full px-4 py-3 text-left hover:bg-muted/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{formatShortDate(entry.day, timeZone)}</p>
                    {entry.mood ? <Badge tone="neutral">{MOOD_LABELS[entry.mood]}</Badge> : null}
                    {entry.aiAllowed ? <Badge tone="warning">AI readable</Badge> : <Badge tone="neutral">Private</Badge>}
                    {entry.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.body}</p>
                </button>
                <div className="flex justify-end px-4 pb-3">
                  <Button size="sm" variant="ghost" onClick={() => archive(entry)} disabled={busy}>
                    Archive
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
