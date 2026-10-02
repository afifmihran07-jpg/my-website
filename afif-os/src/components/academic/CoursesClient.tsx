"use client";

import * as React from "react";
import { BookOpen, Pencil, Trash2 } from "lucide-react";

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
  Progress,
  Select,
} from "@/components/ui/primitives";
import { createCourseAction, updateCourseAction } from "@/server/services/academic-actions";

type Semester = { id: string; name: string; status: string };

type Row = {
  id: string;
  semesterId: string;
  semesterName: string;
  code: string;
  name: string;
  credits: number;
  faculty: string | null;
  section: string | null;
  color: string | null;
  status: string;
  targetGrade: string | null;
  assessmentCount: number;
  gradedCount: number;
  totalWeight: number;
  gradedWeight: number;
};

const EMPTY = { code: "", name: "", semesterId: "", credits: "3", faculty: "", section: "", targetGrade: "" };

export function CoursesClient({ rows, semesters }: { rows: Row[]; semesters: Semester[] }) {
  const [busy, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState(EMPTY);

  const bySemester = React.useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const list = map.get(row.semesterId) ?? [];
      list.push(row);
      map.set(row.semesterId, list);
    }
    return map;
  }, [rows]);

  function openCreate() {
    const active = semesters.find((semester) => semester.status === "active") ?? semesters[0];
    setDraft({ ...EMPTY, semesterId: active?.id ?? "" });
    setCreating(true);
  }

  function openEdit(row: Row) {
    setDraft({
      code: row.code,
      name: row.name,
      semesterId: row.semesterId,
      credits: String(row.credits),
      faculty: row.faculty ?? "",
      section: row.section ?? "",
      targetGrade: row.targetGrade ?? "",
    });
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Courses</h1>
          <p className="text-sm text-muted-foreground">
            Every course belongs to a semester. Grading weight is whatever you configured on its assessments.
          </p>
        </div>
        <Button onClick={openCreate} disabled={semesters.length === 0}>
          New course
        </Button>
      </div>

      {semesters.length === 0 ? (
        <Alert variant="warning" title="Create a semester first">
          Courses must belong to a semester.{" "}
          <a href="/academic/semesters" className="underline">
            Add one
          </a>{" "}
          and this page will let you add courses.
        </Alert>
      ) : null}

      {error ? <Alert variant="error" title={error} /> : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-8 w-8" />}
            title="No courses yet"
            description="Add the courses you are taking this semester."
            action={semesters.length > 0 ? <Button onClick={openCreate}>New course</Button> : undefined}
          />
        </Card>
      ) : (
        semesters.map((semester) => {
          const list = bySemester.get(semester.id) ?? [];
          if (list.length === 0) return null;
          const credits = list.reduce((sum, row) => sum + row.credits, 0);
          return (
            <Card key={semester.id}>
              <CardHeader
                title={semester.name}
                subtitle={`${list.length} course${list.length === 1 ? "" : "s"} · ${credits} credits`}
                action={semester.status === "active" ? <Badge tone="accent">Active</Badge> : undefined}
              />
              <ul className="divide-y divide-border">
                {list.map((row) => {
                  const gradedPercent = row.totalWeight > 0 ? Math.round((row.gradedWeight / row.totalWeight) * 100) : 0;
                  return (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-medium">
                            {row.color ? (
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                            ) : null}
                            <span className="truncate">
                              {row.code} — {row.name}
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.credits} credits
                            {row.faculty ? ` · ${row.faculty}` : ""}
                            {row.section ? ` · Section ${row.section}` : ""}
                            {row.targetGrade ? ` · Target ${row.targetGrade}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => start(() => run(() => updateCourseAction(row.id, { archived: true }), () => undefined))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Archive {row.code}</span>
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex-1">
                          <Progress value={gradedPercent} tone={gradedPercent === 100 ? "primary" : "accent"} />
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.gradedCount}/{row.assessmentCount} graded · {gradedPercent}% of weight
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })
      )}

      <Modal
        open={creating || editing !== null}
        onClose={close}
        title={editing ? `Edit ${editing.code}` : "New course"}
        description={editing ? "Changing credits recalculates the semester CGPA." : "Assessments are added on the Grades page."}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                start(() =>
                  run(
                    () => (editing ? updateCourseAction(editing.id, draft) : createCourseAction(draft)),
                    close,
                  ),
                )
              }
            >
              {editing ? "Save" : "Create course"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editing ? null : (
            <Field label="Semester" required>
              <Select value={draft.semesterId} onChange={(e) => setDraft({ ...draft, semesterId: e.target.value })}>
                <option value="">Choose a semester…</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name}
                    {semester.status === "active" ? " (active)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
            <Field label="Code" required>
              <Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="CSE111" />
            </Field>
            <Field label="Name" required>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Programming Language I"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Credits">
              <Input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={draft.credits}
                onChange={(e) => setDraft({ ...draft, credits: e.target.value })}
              />
            </Field>
            <Field label="Faculty">
              <Input value={draft.faculty} onChange={(e) => setDraft({ ...draft, faculty: e.target.value })} />
            </Field>
            <Field label="Section">
              <Input value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })} />
            </Field>
          </div>
          <Field label="Target grade" hint="Optional — feeds the target calculator, which computes what you need rather than predicting it.">
            <Input
              value={draft.targetGrade}
              onChange={(e) => setDraft({ ...draft, targetGrade: e.target.value })}
              placeholder="A-"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
