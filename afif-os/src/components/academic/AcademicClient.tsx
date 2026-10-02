"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calculator, GraduationCap, Plus, Target } from "lucide-react";
import {
  createAssessmentAction,
  createCourseAction,
  createSemesterAction,
  evaluateTargetAction,
  recordGradeAction,
} from "@/server/services/academic-actions";
import type { Feasibility } from "@/server/services/dashboard";
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Progress, Select } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

type CourseRow = {
  id: string;
  code: string;
  name: string;
  credits: number;
  color: string;
  status: string;
  targetGrade: string | null;
  gradedWeight: number;
  earnedPercentOfGraded: number | null;
  securedPercent: number;
  maxPossiblePercent: number;
  gradePoint: number | null;
  letter: string | null;
  assessments: Array<{
    id: string;
    name: string;
    kind: string;
    maxMarks: number;
    weight: number;
    obtainedMarks: number | null;
    scheduledFor: string | null;
  }>;
};

export function AcademicClient({
  semesters,
  activeSemester,
  courses,
  semesterCgpa,
  semesterCredits,
  overallCgpa,
  overallCredits,
}: {
  semesters: Array<{ id: string; name: string; status: string }>;
  activeSemester: { id: string; name: string; status: string } | null;
  courses: CourseRow[];
  semesterCgpa: number | null;
  semesterCredits: number;
  overallCgpa: number | null;
  overallCredits: number;
}) {
  const router = useRouter();
  const [panel, setPanel] = React.useState<null | "semester" | "course" | "assessment">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState("4.00");
  const [feasibility, setFeasibility] = React.useState<Feasibility | null>(null);
  const [gradeInputs, setGradeInputs] = React.useState<Record<string, string>>({});

  const semesterForm = { name: "", startDate: "", endDate: "" };
  const [semester, setSemester] = React.useState(semesterForm);
  const [course, setCourse] = React.useState({ semesterId: activeSemester?.id ?? "", code: "", name: "", credits: "3", faculty: "", section: "" });
  const [assessment, setAssessment] = React.useState({ courseId: "", name: "", kind: "assignment", maxMarks: "100", weight: "10", scheduledFor: "" });

  const run = async (name: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setPending(name);
    setError(null);
    const result = await fn();
    setPending(null);
    if (!result.ok) setError(result.error ?? "Something went wrong.");
    router.refresh();
    return result.ok;
  };

  const evaluate = async () => {
    if (!activeSemester) return;
    setPending("target");
    const result = await evaluateTargetAction(activeSemester.id, Number(target));
    setPending(null);
    if (result.ok) setFeasibility(result.data);
    else setError(result.error);
  };

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Semester CGPA</p>
          <p className="tabular mt-1 text-2xl font-semibold text-primary">{semesterCgpa !== null ? semesterCgpa.toFixed(2) : "—"}</p>
          <p className="text-[11px] text-muted-foreground">
            {activeSemester?.name ?? "No active semester"} · {semesterCredits} credits counted
          </p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Overall CGPA</p>
          <p className="tabular mt-1 text-2xl font-semibold">{overallCgpa !== null ? overallCgpa.toFixed(2) : "—"}</p>
          <p className="text-[11px] text-muted-foreground">Credit-weighted across {overallCredits} credits</p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Courses</p>
          <p className="tabular mt-1 text-2xl font-semibold">{courses.length}</p>
          <p className="text-[11px] text-muted-foreground">In {activeSemester?.name ?? "this semester"}</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Academic target calculator"
          subtitle="Arithmetic only — it tells you what is still reachable, never what will happen"
          icon={<Calculator className="h-4 w-4" />}
        />
        <div className="px-4 py-3">
          {!activeSemester ? (
            <p className="text-xs text-muted-foreground">Create a semester and add courses first.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Target CGPA" className="w-32">
                  <Input value={target} onChange={(event) => setTarget(event.target.value)} inputMode="decimal" />
                </Field>
                <Button size="md" onClick={evaluate} loading={pending === "target"} disabled={!Number.isFinite(Number(target))}>
                  <Target className="h-4 w-4" />
                  Check feasibility
                </Button>
              </div>
              {feasibility ? (
                <Alert
                  className="mt-3"
                  variant={feasibility.achievable ? "success" : "warning"}
                  title={`${feasibility.target.toFixed(2)} is ${feasibility.achievable ? "still reachable" : "no longer reachable"}`}
                >
                  {feasibility.detail}
                  {feasibility.alternatives.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {feasibility.alternatives.map((alternative) => (
                        <button
                          key={alternative}
                          onClick={() => setTarget(alternative.toFixed(2))}
                          className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium hover:bg-muted"
                        >
                          Try {alternative.toFixed(2)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </Alert>
              ) : null}
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Courses"
          subtitle={activeSemester?.name ?? "No semester selected"}
          icon={<GraduationCap className="h-4 w-4" />}
          action={
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => setPanel(panel === "semester" ? null : "semester")}>
                <Plus className="h-3.5 w-3.5" />
                Semester
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPanel(panel === "course" ? null : "course")}>
                <Plus className="h-3.5 w-3.5" />
                Course
              </Button>
            </div>
          }
        />

        {panel === "semester" ? (
          <form
            className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await run("semester", () => createSemesterAction({ ...semester, status: "active" }));
              setSemester(semesterForm);
              setPanel(null);
            }}
          >
            <Field label="Semester name">
              <Input value={semester.name} onChange={(event) => setSemester((s) => ({ ...s, name: event.target.value }))} placeholder="Semester 2" />
            </Field>
            <Field label="Start">
              <Input type="date" value={semester.startDate} onChange={(event) => setSemester((s) => ({ ...s, startDate: event.target.value }))} />
            </Field>
            <Field label="End">
              <Input type="date" value={semester.endDate} onChange={(event) => setSemester((s) => ({ ...s, endDate: event.target.value }))} />
            </Field>
            <div className="flex items-end">
              <Button type="submit" size="md" full loading={pending === "semester"} disabled={!semester.name}>
                Add semester
              </Button>
            </div>
          </form>
        ) : null}

        {panel === "course" ? (
          <form
            className="grid gap-3 border-b border-border px-4 py-3 sm:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault();
              await run("course", () =>
                createCourseAction({ ...course, semesterId: course.semesterId || activeSemester?.id }),
              );
              setCourse((c) => ({ ...c, code: "", name: "" }));
              setPanel(null);
            }}
          >
            <Field label="Semester">
              <Select value={course.semesterId} onChange={(event) => setCourse((c) => ({ ...c, semesterId: event.target.value }))}>
                {semesters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Code">
              <Input value={course.code} onChange={(event) => setCourse((c) => ({ ...c, code: event.target.value }))} placeholder="CSE111" />
            </Field>
            <Field label="Name">
              <Input value={course.name} onChange={(event) => setCourse((c) => ({ ...c, name: event.target.value }))} placeholder="Programming Language I" />
            </Field>
            <Field label="Credits">
              <Input value={course.credits} onChange={(event) => setCourse((c) => ({ ...c, credits: event.target.value }))} inputMode="decimal" />
            </Field>
            <Field label="Faculty">
              <Input value={course.faculty} onChange={(event) => setCourse((c) => ({ ...c, faculty: event.target.value }))} />
            </Field>
            <div className="flex items-end">
              <Button type="submit" size="md" full loading={pending === "course"} disabled={!course.code || !course.name}>
                Add course
              </Button>
            </div>
          </form>
        ) : null}

        {courses.length === 0 ? (
          <EmptyState title="No courses yet" description="Add a semester and then a course to start tracking marks." />
        ) : (
          <ul className="divide-y divide-border">
            {courses.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="text-sm font-semibold">{row.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{row.name}</span>
                  <Badge tone="neutral">{row.credits} cr</Badge>
                  {row.letter ? <Badge tone="primary">{row.letter}</Badge> : null}
                  {row.gradePoint !== null ? <Badge tone="accent">GP {row.gradePoint.toFixed(2)}</Badge> : null}
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Earned so far</span>
                      <span className="tabular">{row.securedPercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={row.securedPercent} tone="primary" className="mt-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Graded weight</span>
                      <span className="tabular">{row.gradedWeight.toFixed(0)}%</span>
                    </div>
                    <Progress value={row.gradedWeight} tone="warning" className="mt-1" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Best possible</span>
                      <span className="tabular">{row.maxPossiblePercent.toFixed(1)}%</span>
                    </div>
                    <Progress value={row.maxPossiblePercent} tone="accent" className="mt-1" />
                  </div>
                </div>

                {row.assessments.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="pb-1 font-medium">Assessment</th>
                          <th className="pb-1 font-medium">Weight</th>
                          <th className="pb-1 font-medium">Max</th>
                          <th className="pb-1 font-medium">Obtained</th>
                          <th className="pb-1" />
                        </tr>
                      </thead>
                      <tbody>
                        {row.assessments.map((item) => (
                          <tr key={item.id} className="border-t border-border">
                            <td className="py-1.5 pr-2">
                              {item.name}
                              <span className="ml-1 text-[10px] text-muted-foreground">{item.kind}</span>
                            </td>
                            <td className="tabular py-1.5 pr-2">{item.weight}%</td>
                            <td className="tabular py-1.5 pr-2">{item.maxMarks}</td>
                            <td className="py-1.5 pr-2">
                              <Input
                                className="h-7 w-20 text-xs"
                                inputMode="decimal"
                                value={gradeInputs[item.id] ?? (item.obtainedMarks !== null ? String(item.obtainedMarks) : "")}
                                onChange={(event) => setGradeInputs((g) => ({ ...g, [item.id]: event.target.value }))}
                                placeholder="—"
                                aria-label={`Marks for ${item.name}`}
                              />
                            </td>
                            <td className="py-1.5 text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={pending === `grade-${item.id}`}
                                disabled={!gradeInputs[item.id]}
                                onClick={() =>
                                  run(`grade-${item.id}`, () =>
                                    recordGradeAction({ assessmentId: item.id, obtainedMarks: Number(gradeInputs[item.id]) }),
                                  )
                                }
                              >
                                Save
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setAssessment((a) => ({ ...a, courseId: row.id })); setPanel(panel === "assessment" ? null : "assessment"); }}>
                    <Plus className="h-3.5 w-3.5" />
                    Add assessment
                  </Button>
                  {row.targetGrade ? <Badge tone="neutral">target {row.targetGrade}</Badge> : null}
                </div>

                {panel === "assessment" && assessment.courseId === row.id ? (
                  <form
                    className={cn("mt-2 grid gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-5")}
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await run("assessment", () => createAssessmentAction(assessment));
                      setAssessment((a) => ({ ...a, name: "", maxMarks: "100", weight: "10" }));
                    }}
                  >
                    <Field label="Name" className="sm:col-span-2">
                      <Input value={assessment.name} onChange={(event) => setAssessment((a) => ({ ...a, name: event.target.value }))} placeholder="Midterm" />
                    </Field>
                    <Field label="Max marks">
                      <Input value={assessment.maxMarks} onChange={(event) => setAssessment((a) => ({ ...a, maxMarks: event.target.value }))} inputMode="decimal" />
                    </Field>
                    <Field label="Weight %">
                      <Input value={assessment.weight} onChange={(event) => setAssessment((a) => ({ ...a, weight: event.target.value }))} inputMode="decimal" />
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" size="md" full loading={pending === "assessment"} disabled={!assessment.name}>
                        Add
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
