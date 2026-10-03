"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, BookmarkPlus, CheckCircle2, Flame, Pencil, Plus, Trash2 } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Label,
  Modal,
  Progress,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { formatHoursMinutes, formatShortDate } from "@/lib/format";
import { createBookAction, logReadingAction, updateBookAction } from "@/server/services/books-actions";
import { BOOK_STATUS_LABELS, BOOK_STATUS_TONES } from "@/lib/labels";
import type { SerializedBook, SerializedReadingSession } from "@/server/services/books-validation";

type Stats = {
  total: number;
  reading: number;
  completed: number;
  wantToRead: number;
  paused: number;
  pagesRead: number;
  totalSeconds: number;
  pagesThisWeek: number;
  booksFinishedThisYear: number;
  weeklyTargets: { id: string; title: string; target: number; actual: number; percent: number }[];
};

type Domain = { id: string; name: string; category: string };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "reading", label: "Reading" },
  { key: "want_to_read", label: "Want to read" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Finished" },
] as const;

const emptyForm = {
  title: "",
  author: "",
  totalPages: "",
  status: "want_to_read" as SerializedBook["status"],
  targetFinishDate: "",
  dailyPageTarget: "",
  domainId: "",
  rating: "",
  review: "",
};

export function BooksClient({
  books,
  stats,
  domains,
  sessions,
  streak,
  timeZone,
}: {
  books: SerializedBook[];
  stats: Stats;
  domains: Domain[];
  sessions: SerializedReadingSession[];
  streak: { current: number; longest: number };
  timeZone: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedBook | null>(null);
  const [logging, setLogging] = React.useState<SerializedBook | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [logForm, setLogForm] = React.useState({ pagesTo: "", durationMinutes: "", notes: "" });

  const visible = filter === "all" ? books : books.filter((book) => book.status === filter);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(book: SerializedBook) {
    setEditing(book);
    setForm({
      title: book.title,
      author: book.author ?? "",
      totalPages: book.totalPages ? String(book.totalPages) : "",
      status: book.status,
      targetFinishDate: book.targetFinishDate ?? "",
      dailyPageTarget: book.dailyPageTarget ? String(book.dailyPageTarget) : "",
      domainId: book.domainId ?? "",
      rating: book.rating ? String(book.rating) : "",
      review: book.review ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  function openLog(book: SerializedBook) {
    setLogging(book);
    setLogForm({ pagesTo: String(book.currentPage), durationMinutes: "", notes: "" });
    setError(null);
  }

  async function submitForm() {
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title,
      author: form.author,
      totalPages: form.totalPages,
      status: form.status,
      targetFinishDate: form.targetFinishDate || null,
      dailyPageTarget: form.dailyPageTarget,
      domainId: form.domainId || null,
      ...(editing ? { rating: form.rating || null, review: form.review } : {}),
    };
    const result = editing
      ? await updateBookAction(editing.id, payload)
      : await createBookAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function submitLog() {
    if (!logging) return;
    setBusy(true);
    setError(null);
    const result = await logReadingAction({
      bookId: logging.id,
      pagesTo: logForm.pagesTo,
      durationMinutes: logForm.durationMinutes || null,
      notes: logForm.notes || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLogging(null);
    router.refresh();
  }

  async function archive(book: SerializedBook) {
    setBusy(true);
    const result = await updateBookAction(book.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && !formOpen && !logging ? (
        <Alert variant="error" title="Could not save that">{error}</Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Reading now" value={String(stats.reading)} hint={`${stats.total} books tracked`} />
        <StatCard
          label="Pages this week"
          value={String(stats.pagesThisWeek)}
          hint={`${stats.pagesRead.toLocaleString()} pages all time`}
        />
        <StatCard
          label="Reading time"
          value={formatHoursMinutes(stats.totalSeconds)}
          hint={`${sessions.length} logged sessions`}
        />
        <StatCard
          label="Day streak"
          value={`${streak.current}d`}
          hint={`Best: ${streak.longest}d · ${stats.booksFinishedThisYear} finished this year`}
          icon={<Flame className="h-4 w-4" />}
        />
      </div>

      {stats.weeklyTargets.length > 0 ? (
        <Card>
          <CardHeader
            title="Weekly page targets"
            subtitle="Actual pages logged this week against your daily target — measured, not estimated."
          />
          <div className="space-y-3 p-4 pt-0">
            {stats.weeklyTargets.map((target) => (
              <div key={target.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{target.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {target.actual} / {target.target} pages
                  </span>
                </div>
                <Progress value={target.percent} tone={target.percent >= 100 ? "accent" : "primary"} />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Library"
          subtitle="Everything you are reading, have read, or plan to read."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add book
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-border px-4 pb-3">
          {FILTERS.map((item) => {
            const count =
              item.key === "all" ? books.length : books.filter((book) => book.status === item.key).length;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  filter === item.key
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {item.label} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-8 w-8" />}
            title={books.length === 0 ? "No books yet" : `Nothing ${filter === "all" ? "here" : "in this list"}`}
            description="Add a book to start tracking pages, reading time and progress. Every number here comes from sessions you actually log."
            action={
              <Button size="sm" onClick={openAdd}>
                <BookmarkPlus className="h-4 w-4" /> Add your first book
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((book) => (
              <li key={book.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{book.title}</p>
                      <Badge tone={BOOK_STATUS_TONES[book.status]}>{BOOK_STATUS_LABELS[book.status]}</Badge>
                      {book.domainName ? <Badge tone="neutral">{book.domainName}</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {book.author ?? "Unknown author"}
                      {book.totalPages ? ` · ${book.totalPages} pages` : ""}
                      {book.rating ? ` · ${"★".repeat(book.rating)}${"☆".repeat(5 - book.rating)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => openLog(book)}>
                      <Plus className="h-3.5 w-3.5" /> Log pages
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(book)} aria-label={`Edit ${book.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => archive(book)}
                      disabled={busy}
                      aria-label={`Archive ${book.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {book.totalPages ? (
                  <div className="mt-3">
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">
                        Page {book.currentPage} of {book.totalPages}
                      </span>
                      <span className="font-medium">{book.progressPercent}%</span>
                    </div>
                    <Progress value={book.progressPercent ?? 0} tone={book.status === "completed" ? "accent" : "primary"} />
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {book.sessionsCount ? <span>{book.sessionsCount} sessions</span> : null}
                  {book.totalSeconds ? <span>{formatHoursMinutes(book.totalSeconds)} logged</span> : null}
                  {book.recentPagesPerDay > 0 ? <span>{book.recentPagesPerDay} pages/day (14d)</span> : null}
                  {book.requiredPagesPerDay !== null ? (
                    <span className={book.daysToTarget !== null && book.daysToTarget < 0 ? "text-danger" : ""}>
                      {book.daysToTarget !== null && book.daysToTarget < 0
                        ? `Target date passed`
                        : `Need ${book.requiredPagesPerDay}/day to finish by ${formatShortDate(book.targetFinishDate!, timeZone)}`}
                    </span>
                  ) : null}
                  {book.finishedAt ? <span>Finished {formatShortDate(book.finishedAt, timeZone)}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent reading" subtitle="Every logged session, newest first." />
        {sessions.length === 0 ? (
          <EmptyState title="No reading sessions logged yet" description="Use “Log pages” on a book to record what you read." />
        ) : (
          <ul className="divide-y divide-border">
            {sessions.slice(0, 12).map((session) => (
              <li key={session.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium">{session.bookTitle}</p>
                  <p className="text-muted-foreground">
                    pages {session.pagesFrom} → {session.pagesTo}
                    {session.notes ? ` · “${session.notes}”` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-muted-foreground">
                  <p className="font-medium text-foreground">
                    +{session.pagesRead} pages
                    {session.durationSeconds ? ` · ${formatHoursMinutes(session.durationSeconds)}` : ""}
                  </p>
                  <p>{formatShortDate(session.startedAt!, timeZone)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit book" : "Add a book"}
        description="Page count and targets are optional — progress is computed from the pages you log."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitForm} loading={busy} disabled={!form.title.trim()}>
              {editing ? "Save changes" : "Add book"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Thinking, Fast and Slow" />
          </Field>
          <Field label="Author">
            <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Daniel Kahneman" />
          </Field>
          <Field label="Total pages" hint="Leave blank if you don't know yet">
            <Input
              type="number"
              min={1}
              value={form.totalPages}
              onChange={(e) => setForm({ ...form, totalPages: e.target.value })}
              placeholder="499"
            />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as SerializedBook["status"] })}>
              {Object.entries(BOOK_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Knowledge domain" hint="Links the book into your polymath map">
            <Select value={form.domainId} onChange={(e) => setForm({ ...form, domainId: e.target.value })}>
              <option value="">Not linked</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target finish date">
            <Input
              type="date"
              value={form.targetFinishDate}
              onChange={(e) => setForm({ ...form, targetFinishDate: e.target.value })}
            />
          </Field>
          <Field label="Daily page target" hint="Used for the weekly target panel">
            <Input
              type="number"
              min={1}
              value={form.dailyPageTarget}
              onChange={(e) => setForm({ ...form, dailyPageTarget: e.target.value })}
              placeholder="20"
            />
          </Field>
          {editing ? (
            <>
              <Field label="Rating">
                <Select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
                  <option value="">Not rated</option>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {"★".repeat(value)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Review" className="sm:col-span-2">
                <Textarea
                  rows={4}
                  value={form.review}
                  onChange={(e) => setForm({ ...form, review: e.target.value })}
                  placeholder="What did this change in how you think?"
                />
              </Field>
            </>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(logging)}
        onClose={() => setLogging(null)}
        title={logging ? `Log pages — ${logging.title}` : "Log pages"}
        description="The server works out how many pages this session covered from your previous marker."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLogging(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitLog} loading={busy} disabled={logForm.pagesTo === ""}>
              <CheckCircle2 className="h-4 w-4" /> Save session
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        {logging ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              You are currently on page <strong className="text-foreground">{logging.currentPage}</strong>
              {logging.totalPages ? ` of ${logging.totalPages}` : ""}.
            </div>
            <Field label="I am now on page" required>
              <Input
                type="number"
                min={0}
                max={logging.totalPages ?? undefined}
                value={logForm.pagesTo}
                onChange={(e) => setLogForm({ ...logForm, pagesTo: e.target.value })}
              />
            </Field>
            <Field label="Minutes spent" hint="Optional — leave blank if you didn't time it">
              <Input
                type="number"
                min={0}
                value={logForm.durationMinutes}
                onChange={(e) => setLogForm({ ...logForm, durationMinutes: e.target.value })}
                placeholder="45"
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={logForm.notes}
                onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                placeholder="Chapter 4 — the framing effect examples"
              />
            </Field>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="mb-0">{label}</Label>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
