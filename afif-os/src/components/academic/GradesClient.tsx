"use client";

import * as React from "react";
import { Calculator, Plus, Target } from "lucide-react";

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
import {
  createAssessmentAction,
  evaluateTargetAction,
  recordGradeAction,
  type SerializedCourseProgress,
} from "@/server/services/academic-actions";
import { ASSESSMENT_KIND_LABELS } from "@/lib/labels";
import { barPercent } from "@/lib/format";

const KINDS = Object.keys(ASSESSMENT_KIND_LABELS);
const EMPTY_ASSESSMENT = { courseId: "", name: "", kind: "other", maxMarks: "100", weight: "10", scheduledFor: "" };

type Feasibility = {
  target: number;
  achievable: boolean;
  bestPossible: number | null;
  alternatives: number[];
  detail: string;
};

export function GradesClient({
  courses,
  semesters,
  activeSemesterId,
}: {
  courses: SerializedCourseProgress[];
  semesters: { id: string; name: string }[];
  activeSemesterId: string | null;
}) {
  const [busy, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [marks, setMarks] = React.useState<Record<string, string>>({});
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [addingFor, setAddingFor] = React.useState<string | null>(null);
  const [assessment, setAssessment] = React.useState(EMPTY_ASSESSMENT);

  const [target, setTarget] = React.useState("");
  const [semesterId, setSemesterId] = React.useState(activeSemesterId ?? semesters[0]?.id ?? "");
  const [result, setResult] = React.useState<Feasibility | null>(null);

  async function run(fn: () => Promise<unknown>, close?: () => void) {
    setError(null);
    const res = (await fn()) as { ok: boolean; error?: string };
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    close?.();
  }

  function saveMark(assessmentId: string) {
    const value = marks[assessmentId];
    if (value === undefined || value === "") return;
    start(() => run(() => recordGradeAction({ assessmentId, obtainedMarks: Number(value) })));
  }

  async function evaluate() {
    if (!semesterId || target === "") return;
    setError(null);
    const res = (await evaluateTargetAction(semesterId, Number(target))) as
      | { ok: true; data: Feasibility }
      | { ok: false; error: string };
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.data);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Grades</h1>
        <p className="text-sm text-muted-foreground">
          Marks are validated against each assessment&rsquo;s maximum on the server. Percentages and CGPA are always
          recomputed from what you entered.
        </p>
      </div>

      {error ? <Alert variant="error" title={error} /> : null}

      <Card>
        <CardHeader
          title="Target calculator"
          subtitle="Mathematical, not a prediction: it tells you what the remaining assessments must average for a target to be reachable."
          icon={<Calculator className="h-4 w-4" />}
        />
        {semesters.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">Add a semester and courses first.</p>
        ) : (
          <div className="space-y-3 px-4 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-56">
                <Field label="Semester">
                  <Select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
                    {semesters.map((semester) => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="w-32">
                <Field label="Target CGPA">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="3.75"
                  />
                </Field>
              </div>
              <Button onClick={evaluate} disabled={busy || target === ""}>
                <Target className="mr-1.5 h-3.5 w-3.5" />
                Calculate
              </Button>
            </div>

            {result ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Badge tone={result.achievable ? "primary" : "warning"}>
                    {result.achievable ? "Reachable" : "Not reachable"}
                  </Badge>
                  Target {result.target.toFixed(2)}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{result.detail}</p>
                {result.bestPossible !== null ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Best possible with everything remaining at full marks:{" "}
                    <span className="tabular font-medium text-foreground">{result.bestPossible.toFixed(2)}</span>
                    {result.alternatives.length > 0
                      ? ` · closest reachable targets: ${result.alternatives.map((value) => value.toFixed(2)).join(", ")}`
                      : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {courses.length === 0 ? (
        <Card>
          <EmptyState
            title="No courses with assessments yet"
            description="Add courses on the Courses page, then add assessments here to start recording marks."
          />
        </Card>
      ) : (
        courses.map((course) => {
          const isOpen = expanded === course.courseId;
          return (
            <Card key={course.courseId}>
              <CardHeader
                title={`${course.code} — ${course.name}`}
                subtitle={`${course.credits} credits · ${course.gradedWeight.toFixed(0)}% of weight graded`}
                action={
                  <Badge tone={course.letter ? "primary" : "neutral"}>
                    {course.letter ? `${course.letter} · ${course.gradePoint?.toFixed(1) ?? "—"}` : "No grade yet"}
                  </Badge>
                }
              />
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                <SmallStat label="Secured" value={`${course.securedPercent.toFixed(1)}%`} />
                <SmallStat
                  label="Of graded"
                  value={course.earnedPercentOfGraded === null ? "—" : `${course.earnedPercentOfGraded.toFixed(1)}%`}
                />
                <SmallStat label="Max possible" value={`${course.maxPossiblePercent.toFixed(1)}%`} />
              </div>
              <div className="px-4 pb-3">
                <Progress
                  value={barPercent(course.securedPercent, course.maxPossiblePercent, 4)}
                />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : course.courseId)}>
                  {isOpen ? "Hide assessments" : `Assessments (${course.assessments.length})`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAssessment({ ...EMPTY_ASSESSMENT, courseId: course.courseId });
                    setAddingFor(course.courseId);
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add assessment
                </Button>
              </div>

              {isOpen ? (
                course.assessments.length === 0 ? (
                  <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                    No assessments yet. Add the quizzes, midterms and final with their weight.
                  </p>
                ) : (
                  /* The table needs 520px to stay readable; on a phone that is
                     wider than the viewport, so scroll it inside the card
                     instead of letting it push the whole page sideways. */
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-t border-border text-left text-xs">
                    <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">Assessment</th>
                        <th className="px-2 py-2">Weight</th>
                        <th className="px-2 py-2">Max</th>
                        <th className="px-2 py-2">Scheduled</th>
                        <th className="px-4 py-2">Your marks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {course.assessments.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {ASSESSMENT_KIND_LABELS[item.kind as keyof typeof ASSESSMENT_KIND_LABELS] ?? item.kind}
                            </p>
                          </td>
                          <td className="tabular px-2 py-2">{item.weight}%</td>
                          <td className="tabular px-2 py-2">{item.maxMarks}</td>
                          <td className="px-2 py-2 text-muted-foreground">{item.scheduledFor ?? "—"}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <Input
                                className="h-8 w-24 text-xs"
                                type="number"
                                min="0"
                                max={item.maxMarks}
                                step="0.5"
                                value={marks[item.id] ?? (item.obtainedMarks === null ? "" : String(item.obtainedMarks))}
                                onChange={(e) => setMarks({ ...marks, [item.id]: e.target.value })}
                              />
                              <Button size="sm" variant="secondary" disabled={busy} onClick={() => saveMark(item.id)}>
                                Save
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )
              ) : null}
            </Card>
          );
        })
      )}

      <Modal
        open={addingFor !== null}
        onClose={() => setAddingFor(null)}
        title="Add assessment"
        description="Weight is the percentage of the final grade. It does not have to add up to 100 while the semester is running."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddingFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() => start(() => run(() => createAssessmentAction(assessment), () => setAddingFor(null)))}
            >
              Add assessment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required>
            <Input
              value={assessment.name}
              onChange={(e) => setAssessment({ ...assessment, name: e.target.value })}
              placeholder="Midterm 1"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Kind">
              <Select value={assessment.kind} onChange={(e) => setAssessment({ ...assessment, kind: e.target.value })}>
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ASSESSMENT_KIND_LABELS[kind as keyof typeof ASSESSMENT_KIND_LABELS]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Max marks" required>
              <Input
                type="number"
                min="1"
                value={assessment.maxMarks}
                onChange={(e) => setAssessment({ ...assessment, maxMarks: e.target.value })}
              />
            </Field>
            <Field label="Weight %">
              <Input
                type="number"
                min="0"
                max="100"
                value={assessment.weight}
                onChange={(e) => setAssessment({ ...assessment, weight: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Scheduled for">
            <Input
              type="date"
              value={assessment.scheduledFor}
              onChange={(e) => setAssessment({ ...assessment, scheduledFor: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
