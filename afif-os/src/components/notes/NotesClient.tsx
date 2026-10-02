"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2, NotebookPen, Pencil, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { formatShortDate } from "@/lib/format";
import { createNoteAction, updateNoteAction } from "@/server/services/learning-actions";
import type { SerializedNote } from "@/server/services/learning-validation";

type Option = { id: string; name?: string; title?: string; code?: string };

const emptyForm = {
  title: "",
  body: "",
  tags: "",
  courseId: "",
  bookId: "",
  conceptId: "",
  projectId: "",
  domainId: "",
};

export function NotesClient({
  notes,
  tags,
  courses,
  books,
  concepts,
  projects,
  domains,
  timeZone,
}: {
  notes: SerializedNote[];
  tags: { tag: string; count: number }[];
  courses: Option[];
  books: Option[];
  concepts: Option[];
  projects: Option[];
  domains: Option[];
  timeZone: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedNote | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const visible = notes.filter((note) => {
    if (activeTag && !note.tags.includes(activeTag)) return false;
    if (query.trim().length >= 2) {
      const needle = query.trim().toLowerCase();
      return (
        note.title.toLowerCase().includes(needle) ||
        (note.body ?? "").toLowerCase().includes(needle) ||
        note.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    }
    return true;
  });

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(note: SerializedNote) {
    setEditing(note);
    setForm({
      title: note.title,
      body: note.body ?? "",
      tags: note.tags.join(", "),
      courseId: note.courseId ?? "",
      bookId: note.bookId ?? "",
      conceptId: note.conceptId ?? "",
      projectId: note.projectId ?? "",
      domainId: note.domainId ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title,
      body: form.body,
      tags: form.tags,
      courseId: form.courseId || null,
      bookId: form.bookId || null,
      conceptId: form.conceptId || null,
      projectId: form.projectId || null,
      domainId: form.domainId || null,
    };
    const result = editing ? await updateNoteAction(editing.id, payload) : await createNoteAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function togglePin(note: SerializedNote) {
    setBusy(true);
    const result = await updateNoteAction(note.id, { pinned: !note.pinned });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function archive(note: SerializedNote) {
    setBusy(true);
    const result = await updateNoteAction(note.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && !formOpen ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <Card>
        <CardHeader
          title="Notes"
          subtitle={`${notes.length} notes · linked to courses, books, concepts, projects and domains`}
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> New note
            </Button>
          }
        />

        <div className="space-y-3 border-b border-border px-4 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search notes (at least 2 characters)…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag.tag}
                  type="button"
                  onClick={() => setActiveTag(activeTag === tag.tag ? null : tag.tag)}
                  className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
                    activeTag === tag.tag
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  #{tag.tag} <span className="opacity-60">{tag.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<NotebookPen className="h-8 w-8" />}
            title={notes.length === 0 ? "No notes yet" : "Nothing matches that filter"}
            description="Notes are the connective tissue of the system — link each one to the course, book, concept or project it came from."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> New note
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((note) => (
              <li key={note.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {note.pinned ? <Pin className="h-3.5 w-3.5 text-primary" /> : null}
                      <p className="truncate text-sm font-semibold">{note.title}</p>
                      {note.connectionCount ? (
                        <Badge tone="accent">
                          <Link2 className="h-3 w-3" /> {note.connectionCount}
                        </Badge>
                      ) : null}
                    </div>
                    {note.body ? (
                      <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{note.body.slice(0, 400)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {note.tags.map((tag) => (
                        <span key={tag} className="rounded bg-muted px-1.5 py-0.5">
                          #{tag}
                        </span>
                      ))}
                      {note.courseName ? <span>Course: {note.courseName}</span> : null}
                      {note.bookTitle ? <span>Book: {note.bookTitle}</span> : null}
                      {note.conceptTitle ? <span>Concept: {note.conceptTitle}</span> : null}
                      {note.projectName ? <span>Project: {note.projectName}</span> : null}
                      {note.domainName ? <span>Domain: {note.domainName}</span> : null}
                      <span>Updated {formatShortDate(note.updatedAt!, timeZone)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => togglePin(note)} disabled={busy} aria-label={note.pinned ? "Unpin" : "Pin"}>
                      {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(note)} aria-label={`Edit ${note.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(note)} disabled={busy} aria-label={`Archive ${note.title}`}>
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
        title={editing ? "Edit note" : "New note"}
        description="Linking a note is what turns it into part of your knowledge graph."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.title.trim()}>
              {editing ? "Save changes" : "Create note"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="Body" className="sm:col-span-2">
            <Textarea rows={8} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} />
          </Field>
          <Field label="Tags" className="sm:col-span-2" hint="Comma separated">
            <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="proof, lecture-3" />
          </Field>
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
                  {book.title}
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
          <Field label="Project">
            <Select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
              <option value="">Not linked</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Knowledge domain" className="sm:col-span-2">
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
