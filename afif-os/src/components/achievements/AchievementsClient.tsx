"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, ExternalLink, Medal, Pencil, Plus, Trash2 } from "lucide-react";

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
import {
  createAchievementAction,
  createCertificateAction,
  deleteCertificateAction,
  updateAchievementAction,
} from "@/server/services/achievements-actions";
import { ACHIEVEMENT_CATEGORY_LABELS } from "@/lib/labels";
import {
  type SerializedAchievement,
  type SerializedCertificate,} from "@/server/services/achievements-validation";;

type Stats = {
  total: number;
  thisYear: number;
  byCategory: { category: string; count: number }[];
  certificates: number;
  expiringSoon: number;
};

type Option = { id: string; name: string; code?: string };

const emptyForm = {
  title: "",
  description: "",
  occurredOn: new Date().toISOString().slice(0, 10),
  category: "other" as SerializedAchievement["category"],
  projectId: "",
  skillId: "",
  courseId: "",
  proofUrl: "",
  verificationUrl: "",
};

const emptyCertificate = {
  title: "",
  issuer: "",
  issuedOn: new Date().toISOString().slice(0, 10),
  expiresOn: "",
  credentialUrl: "",
  skillId: "",
  courseId: "",
};

export function AchievementsClient({
  groups,
  stats,
  certificates,
  projects,
  skills,
  courses,
  timeZone,
}: {
  groups: { year: string; items: SerializedAchievement[] }[];
  stats: Stats;
  certificates: SerializedCertificate[];
  projects: Option[];
  skills: Option[];
  courses: Option[];
  timeZone: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [certOpen, setCertOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SerializedAchievement | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [certForm, setCertForm] = React.useState(emptyCertificate);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(item: SerializedAchievement) {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      occurredOn: item.occurredOn,
      category: item.category,
      projectId: item.projectId ?? "",
      skillId: item.skillId ?? "",
      courseId: item.courseId ?? "",
      proofUrl: item.proofUrl ?? "",
      verificationUrl: item.verificationUrl ?? "",
    });
    setError(null);
    setFormOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const payload = {
      title: form.title,
      description: form.description,
      occurredOn: form.occurredOn,
      category: form.category,
      projectId: form.projectId || null,
      skillId: form.skillId || null,
      courseId: form.courseId || null,
      proofUrl: form.proofUrl,
      verificationUrl: form.verificationUrl,
    };
    const result = editing ? await updateAchievementAction(editing.id, payload) : await createAchievementAction(payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function submitCertificate() {
    setBusy(true);
    setError(null);
    const result = await createCertificateAction({
      title: certForm.title,
      issuer: certForm.issuer,
      issuedOn: certForm.issuedOn,
      expiresOn: certForm.expiresOn || null,
      credentialUrl: certForm.credentialUrl,
      skillId: certForm.skillId || null,
      courseId: certForm.courseId || null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCertOpen(false);
    setCertForm(emptyCertificate);
    router.refresh();
  }

  async function archive(item: SerializedAchievement) {
    setBusy(true);
    const result = await updateAchievementAction(item.id, { archived: true });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function removeCertificate(id: string) {
    setBusy(true);
    const result = await deleteCertificateAction(id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-6">
      {error && !formOpen && !certOpen ? <Alert variant="error" title="Could not save that">{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Achievements" value={String(stats.total)} hint={`${stats.thisYear} this year`} />
        <StatCard label="Certificates" value={String(stats.certificates)} hint={stats.expiringSoon ? `${stats.expiringSoon} expiring within 90 days` : "None expiring soon"} />
        <StatCard
          label="Top category"
          value={stats.byCategory[0] ? ACHIEVEMENT_CATEGORY_LABELS[stats.byCategory[0].category as keyof typeof ACHIEVEMENT_CATEGORY_LABELS] ?? stats.byCategory[0].category : "—"}
          hint={stats.byCategory[0] ? `${stats.byCategory[0].count} recorded` : "Nothing recorded yet"}
        />
        <StatCard label="Categories" value={String(stats.byCategory.length)} hint="Distinct areas of achievement" />
      </div>

      <Card>
        <CardHeader
          title="Achievements"
          subtitle="A dated record of what you actually did — with proof links where they exist."
          action={
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Record achievement
            </Button>
          }
        />
        {total === 0 ? (
          <EmptyState
            icon={<Medal className="h-8 w-8" />}
            title="No achievements recorded"
            description="Awards, publications, competition results, presentations — anything worth remembering later, with the date it happened."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" /> Record your first
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group) => (
              <div key={group.year} className="p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.year}</p>
                <ul className="space-y-3">
                  {group.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          <Badge tone="neutral">{ACHIEVEMENT_CATEGORY_LABELS[item.category]}</Badge>
                          {item.skillName ? <Badge tone="accent">{item.skillName}</Badge> : null}
                          {item.projectName ? <Badge tone="primary">{item.projectName}</Badge> : null}
                          {item.courseName ? <Badge tone="neutral">{item.courseName}</Badge> : null}
                        </div>
                        {item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{formatShortDate(item.occurredOn, timeZone)}</span>
                          {item.certificateCount ? <span>{item.certificateCount} certificate(s)</span> : null}
                          {item.proofUrl ? (
                            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={item.proofUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3" /> Proof
                            </a>
                          ) : null}
                          {item.verificationUrl ? (
                            <a className="inline-flex items-center gap-1 text-primary hover:underline" href={item.verificationUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3" /> Verify
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)} aria-label={`Edit ${item.title}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => archive(item)} disabled={busy} aria-label={`Archive ${item.title}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Certificates"
          subtitle="Issued credentials, with expiry tracked so nothing lapses unnoticed."
          action={
            <Button size="sm" variant="secondary" onClick={() => setCertOpen(true)}>
              <Award className="h-4 w-4" /> Add certificate
            </Button>
          }
        />
        {certificates.length === 0 ? (
          <EmptyState title="No certificates added" description="Course completions, professional certifications, workshop credentials." />
        ) : (
          <ul className="divide-y divide-border">
            {certificates.map((certificate) => (
              <li key={certificate.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{certificate.title}</p>
                    {certificate.expired ? <Badge tone="danger">Expired</Badge> : null}
                    {certificate.skillName ? <Badge tone="accent">{certificate.skillName}</Badge> : null}
                    {certificate.courseName ? <Badge tone="neutral">{certificate.courseName}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {certificate.issuer ?? "Unknown issuer"} · issued {formatShortDate(certificate.issuedOn, timeZone)}
                    {certificate.expiresOn ? ` · expires ${formatShortDate(certificate.expiresOn, timeZone)}` : ""}
                  </p>
                  {certificate.credentialUrl ? (
                    <a className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary hover:underline" href={certificate.credentialUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" /> Credential
                    </a>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeCertificate(certificate.id)} disabled={busy} aria-label={`Remove ${certificate.title}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit achievement" : "Record an achievement"}
        description="Link it to a skill, project or course so it shows up as evidence where it belongs."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} loading={busy} disabled={!form.title.trim()}>
              {editing ? "Save changes" : "Record it"}
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="1st place, National Math Olympiad" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Date it happened" required>
            <Input type="date" value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as SerializedAchievement["category"] })}>
              {Object.entries(ACHIEVEMENT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Skill">
            <Select value={form.skillId} onChange={(e) => setForm({ ...form, skillId: e.target.value })}>
              <option value="">Not linked</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">Not linked</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Course" className="sm:col-span-2">
            <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              <option value="">Not linked</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code ? `${course.code} — ` : ""}
                  {course.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proof URL">
            <Input value={form.proofUrl} onChange={(e) => setForm({ ...form, proofUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Verification URL">
            <Input value={form.verificationUrl} onChange={(e) => setForm({ ...form, verificationUrl: e.target.value })} placeholder="https://…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={certOpen}
        onClose={() => setCertOpen(false)}
        title="Add a certificate"
        description="Expiry is tracked automatically when you set an end date."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCertOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitCertificate} loading={busy} disabled={!certForm.title.trim()}>
              Add certificate
            </Button>
          </>
        }
      >
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" required className="sm:col-span-2">
            <Input value={certForm.title} onChange={(e) => setCertForm({ ...certForm, title: e.target.value })} placeholder="AWS Certified Solutions Architect" />
          </Field>
          <Field label="Issuer">
            <Input value={certForm.issuer} onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })} placeholder="Amazon Web Services" />
          </Field>
          <Field label="Credential URL">
            <Input value={certForm.credentialUrl} onChange={(e) => setCertForm({ ...certForm, credentialUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Issued on" required>
            <Input type="date" value={certForm.issuedOn} onChange={(e) => setCertForm({ ...certForm, issuedOn: e.target.value })} />
          </Field>
          <Field label="Expires on" hint="Leave blank if it never expires">
            <Input type="date" value={certForm.expiresOn} onChange={(e) => setCertForm({ ...certForm, expiresOn: e.target.value })} />
          </Field>
          <Field label="Skill">
            <Select value={certForm.skillId} onChange={(e) => setCertForm({ ...certForm, skillId: e.target.value })}>
              <option value="">Not linked</option>
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Course">
            <Select value={certForm.courseId} onChange={(e) => setCertForm({ ...certForm, courseId: e.target.value })}>
              <option value="">Not linked</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code ? `${course.code} — ` : ""}
                  {course.name}
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
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
