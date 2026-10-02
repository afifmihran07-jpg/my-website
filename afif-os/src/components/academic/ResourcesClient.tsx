"use client";

import * as React from "react";
import { ExternalLink, FolderKanban, Pencil, Trash2 } from "lucide-react";

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
import {
  createResourceAction,
  deleteResourceAction,
  updateResourceAction,
} from "@/server/services/academic-actions";
import { RESOURCE_KINDS, type ResourceKind } from "@/lib/labels";
import { RESOURCE_KIND_LABELS } from "@/lib/labels";

type Row = {
  id: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  title: string;
  url: string;
  kind: ResourceKind;
  notes: string | null;
};

const EMPTY = { courseId: "", title: "", url: "", kind: "link" as ResourceKind, notes: "" };

export function ResourcesClient({
  rows,
  courseOptions,
}: {
  rows: Row[];
  courseOptions: { id: string; code: string; name: string }[];
}) {
  const [busy, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("all");
  const [draft, setDraft] = React.useState(EMPTY);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [creating, setCreating] = React.useState(false);

  const visible = filter === "all" ? rows : rows.filter((row) => row.courseId === filter);

  const byCourse = React.useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of visible) {
      const list = map.get(row.courseId) ?? [];
      list.push(row);
      map.set(row.courseId, list);
    }
    return map;
  }, [visible]);

  function openCreate() {
    setDraft({ ...EMPTY, courseId: courseOptions[0]?.id ?? "" });
    setCreating(true);
  }

  function openEdit(row: Row) {
    setDraft({ courseId: row.courseId, title: row.title, url: row.url, kind: row.kind, notes: row.notes ?? "" });
    setEditing(row);
  }

  async function run(fn: () => Promise<unknown>, close: () => void) {
    setError(null);
    const result = (await fn()) as { ok: boolean; error?: string };
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    close();
  }

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Course resources</h1>
          <p className="text-sm text-muted-foreground">
            Links are stored as URLs in your database. Nothing is downloaded or mirrored here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All courses</option>
            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code}
              </option>
            ))}
          </Select>
          <Button onClick={openCreate} disabled={courseOptions.length === 0}>
            Add resource
          </Button>
        </div>
      </div>

      {courseOptions.length === 0 ? (
        <Alert variant="warning" title="Add a course first">
          Resources are attached to a course.{" "}
          <a href="/academic/courses" className="underline">
            Create one
          </a>{" "}
          and this page will let you attach links to it.
        </Alert>
      ) : null}

      {error ? <Alert variant="error" title={error} /> : null}

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="h-8 w-8" />}
            title={rows.length === 0 ? "No resources saved" : "Nothing for this course yet"}
            description="Save lecture slides, past papers, repositories and videos against the course they belong to."
            action={courseOptions.length > 0 ? <Button onClick={openCreate}>Add resource</Button> : undefined}
          />
        </Card>
      ) : (
        courseOptions.map((course) => {
          const list = byCourse.get(course.id) ?? [];
          if (list.length === 0) return null;
          return (
            <Card key={course.id}>
              <CardHeader
                title={`${course.code} — ${course.name}`}
                subtitle={`${list.length} resource${list.length === 1 ? "" : "s"}`}
              />
              <ul className="divide-y divide-border">
                {list.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                      >
                        <span className="truncate">{row.title}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.url}</p>
                      {row.notes ? <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge tone="neutral">{RESOURCE_KIND_LABELS[row.kind]}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit {row.title}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => start(() => run(() => deleteResourceAction(row.id), () => undefined))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete {row.title}</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}

      <Modal
        open={creating || editing !== null}
        onClose={close}
        title={editing ? "Edit resource" : "Add resource"}
        description="Only the link and your notes are stored."
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {editing ? (
              <>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => start(() => run(() => deleteResourceAction(editing.id), close))}
                >
                  Delete
                </Button>
                <Button disabled={busy} onClick={() => start(() => run(() => updateResourceAction(editing.id, draft), close))}>
                  Save
                </Button>
              </>
            ) : (
              <Button disabled={busy} onClick={() => start(() => run(() => createResourceAction(draft), close))}>
                Add resource
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Course" required>
            <Select
              value={draft.courseId}
              onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
              disabled={editing !== null}
            >
              <option value="">Choose a course…</option>
              {courseOptions.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} — {course.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" required>
            <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Lecture 3 slides" />
          </Field>
          <Field label="URL" required>
            <Input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder="https://"
              inputMode="url"
            />
          </Field>
          <Field label="Kind">
            <Select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as ResourceKind })}
            >
              {RESOURCE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {RESOURCE_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
