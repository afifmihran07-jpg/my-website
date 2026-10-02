"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, HelpCircle, Pencil, Plus, Trash2 } from "lucide-react";

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
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { formatShortDate } from "@/lib/format";
import { createQuestionAction, updateQuestionAction } from "@/server/services/learning-actions";
import {
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_TONES,
  type SerializedQuestion,
} from "@/server/services/learning-validation";

type Option = { id: string; name?: string; title?: string; code?: string };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "researching", label: "Researching" },
  { key: "answered", label: "Answered" },
  { key: "dropped", label: "Dropped" },
] as const;

const emptyForm = {
  question: "",
  context: "",
  answer: "",
  status: "open" as SerializedQuestion["status"],
  courseId: "",
  bookId: "",
  conceptId: "",
  domainId: "",
};

export function QuestionsClient({
  questions,
  courses,
  books,
  concepts,
  domains,
  timeZone,
}: {
  questions: SerializedQuestion[];
  courses: Option[];
  books: Option[];
  concepts: Option[];
  domains: Option[];
  timeZone: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["key"]>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedQuestion | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visible = filter === "all" ? questions : questions.filter((question) => question.status === filter);
  const openCount = questions.filter((question) => question.status === "open" || question.status === "researching").length;
  const oldest = questions
    .filter((question) => question.status === "open")
    .reduce((max, question) => Math.max(max, question.openDays), 0);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(question: SerializedQuestion) {
    setEditing(question);
    setForm({
      question: question.question,
      context: question.context ?? "",
      answer: question.answer ?? "",
      status: question.status,
      courseId: question.courseId ?? "",
      bookId: question.bookId ?? "",
      conceptId: question.conceptId ?? "",
      domainId: question.domainId ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      question: form.question,
      context: form.context,
      answer: form.answer,
      status: form.status,
      courseId: form.courseId || null,
      bookId: form.bookId || null,
      conceptId: form.conceptId || null,
      domainId: form.domainId || null,
    };
    const result = editing
      ? await updateQuestionAction(editing.id, payload)
      : await createQuestionAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function setStatus(question: SerializedQuestion, status: SerializedQuestion["status"], answer?: string) {
    setBusy(true);
    const result = await updateQuestionAction(question.id, { status, ...(answer !== undefined ? { answer } : {}) });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function archive(question: SerializedQuestion) {
    setBusy(true);
    const result = await updateQuestionAction(question.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && !formOpen ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total questions" value={String(questions.length)} />
        <StatCard label="Unresolved" value={String(openCount)} hint="Open or still researching" />
        <StatCard label="Answered" value={String(questions.filter((question) => question.status === "answered").length)} />
        <StatCard
          label="Oldest open"
          value={oldest ? `${oldest}d` : "—"}
          hint={oldest > 30 ? "Worth revisiting or dropping" : "Nothing stale yet"}
        />
      </div>

      <Card>
        <CardHeader
          title="Questions"
          subtitle="Things you did not understand yet. They stay visible until you answer them or decide to drop them."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Ask a question
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-border px-4 pb-3">
          {FILTERS.map((item) => {
            const count = item.key === "all" ? questions.length : questions.filter((q) => q.status === item.key).length;
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
            icon={<HelpCircle className="h-8 w-8" />}
            title={questions.length === 0 ? "No questions recorded" : "Nothing in this list"}
            description="Write down what confused you while studying. Answering it later is the fastest way to turn a gap into understanding."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Ask your first
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((question) => (
              <li key={question.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{question.question}</p>
                      <Badge tone={QUESTION_STATUS_TONES[question.status]}>{QUESTION_STATUS_LABELS[question.status]}</Badge>
                    </div>
                    {question.context ? <p className="mt-1 text-xs text-muted-foreground">{question.context}</p> : null}
                    {question.answer ? (
                      <p className="mt-2 whitespace-pre-line rounded-md border border-border bg-muted/40 p-2.5 text-xs">
                        {question.answer}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {question.courseName ? <span>Course: {question.courseName}</span> : null}
                      {question.bookTitle ? <span>Book: {question.bookTitle}</span> : null}
                      {question.conceptTitle ? <span>Concept: {question.conceptTitle}</span> : null}
                      {question.domainName ? <span>Domain: {question.domainName}</span> : null}
                      <span>Asked {formatShortDate(question.createdAt!, timeZone)}</span>
                      {question.status === "answered" && question.answeredAt ? (
                        <span>Answered {formatShortDate(question.answeredAt, timeZone)}</span>
                      ) : null}
                      {question.status === "open" && question.openDays > 14 ? (
                        <span className="text-warning">Open for {question.openDays} days</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {question.status === "open" ? (
                      <Button size="sm" variant="secondary" onClick={() => setStatus(question, "researching")} disabled={busy}>
                        Researching
                      </Button>
                    ) : null}
                    {question.status !== "answered" ? (
                      <Button size="sm" variant="success" onClick={() => openEdit(question)} disabled={busy}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Answer
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setStatus(question, "researching")} disabled={busy}>
                        Reopen
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(question)} aria-label="Edit question">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(question)} disabled={busy} aria-label="Archive question">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit question" : "Ask a question"}
        description="Linking it to a course, book or concept means it surfaces where you will see it again."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.question.trim()}>
              {editing ? "Save changes" : "Save question"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Question" required className="sm:col-span-2">
            <Textarea rows={2} value={form.question} onChange={(event) => setForm({ ...form, question: event.target.value })} placeholder="Why does gradient descent converge?" />
          </Field>
          <Field label="Context" className="sm:col-span-2" hint="Where it came from — helps enormously when you come back later">
            <Textarea rows={2} value={form.context} onChange={(event) => setForm({ ...form, context: event.target.value })} />
          </Field>
          <Field label="Answer" className="sm:col-span-2" hint="Required before a question can be marked answered">
            <Textarea rows={4} value={form.answer} onChange={(event) => setForm({ ...form, answer: event.target.value })} />
          </Field>
          {editing ? (
            <Field label="Status">
              <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as SerializedQuestion["status"] })}>
                {Object.entries(QUESTION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Course">
            <Select value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}>
              <option value="">Not linked</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code ? `${course.code} — ` : ""}
                  {course.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Book">
            <Select value={form.bookId} onChange={(event) => setForm({ ...form, bookId: event.target.value })}>
              <option value="">Not linked</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.name ?? book.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Concept">
            <Select value={form.conceptId} onChange={(event) => setForm({ ...form, conceptId: event.target.value })}>
              <option value="">Not linked</option>
              {concepts.map((concept) => (
                <option key={concept.id} value={concept.id}>
                  {concept.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Knowledge domain">
            <Select value={form.domainId} onChange={(event) => setForm({ ...form, domainId: event.target.value })}>
              <option value="">Not linked</option>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
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
