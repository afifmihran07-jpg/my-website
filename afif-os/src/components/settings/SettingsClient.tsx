"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, KeyRound, LogOut, Save, ShieldCheck } from "lucide-react";
import { changePasswordAction, logoutEverywhereAction } from "@/server/auth/actions";
import {
  exportCsvAction,
  exportJsonAction,
  listSessionsAction,
  updateAiPermissionsAction,
  updateProfileAction,
} from "@/server/services/settings-actions";
import { Alert, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui/primitives";

type Permissions = Record<string, boolean>;

type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

const PERMISSION_LABELS: Array<{ key: string; label: string; hint: string; sensitive?: boolean }> = [
  { key: "academic", label: "Academic", hint: "Semesters, courses, timetables" },
  { key: "grades", label: "Grades", hint: "Assessments, marks, CGPA" },
  { key: "study", label: "Study sessions", hint: "What you studied and for how long" },
  { key: "books", label: "Books", hint: "Reading list and progress" },
  { key: "tasks", label: "Tasks", hint: "Open and completed tasks" },
  { key: "projects", label: "Projects", hint: "Goals and project work" },
  { key: "calendar", label: "Calendar", hint: "Events and deadlines" },
  { key: "polymath", label: "Polymath domains", hint: "Knowledge areas and stages" },
  { key: "skills", label: "Skills", hint: "Skills and their evidence" },
  { key: "questions", label: "Questions", hint: "Open questions and answers" },
  { key: "opportunities", label: "Opportunities", hint: "Competitions, scholarships, roles" },
  { key: "achievements", label: "Achievements", hint: "Awards and certificates" },
  { key: "diary", label: "Diary", hint: "Private writing", sensitive: true },
  { key: "photos", label: "Photos", hint: "Personal photos", sensitive: true },
  { key: "medication", label: "Medication", hint: "Health data", sensitive: true },
  { key: "prayer", label: "Prayer log", hint: "Religious tracking", sensitive: true },
];

export function SettingsClient({
  user,
  permissions,
  csvTables,
}: {
  user: { id: string; fullName: string; username: string; email: string; timezone: string; theme: string; weekStartsOn: number };
  permissions: Permissions;
  csvTables: string[];
}) {
  const router = useRouter();
  const [profile, setProfile] = React.useState({
    fullName: user.fullName,
    timezone: user.timezone,
    theme: user.theme as "light" | "dark" | "system",
    weekStartsOn: String(user.weekStartsOn),
  });
  const [perms, setPerms] = React.useState<Permissions>(permissions);
  const [passwords, setPasswords] = React.useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [sessionList, setSessionList] = React.useState<SessionRow[]>([]);

  const saveProfile = async () => {
    setPending("profile");
    setMessage(null);
    const result = await updateProfileAction({ ...profile, weekStartsOn: Number(profile.weekStartsOn) });
    setPending(null);
    setMessage(
      result.ok
        ? { tone: "success", text: "Profile saved." }
        : { tone: "error", text: result.error },
    );
    router.refresh();
  };

  const togglePermission = async (key: string) => {
    const next = { ...perms, [key]: !perms[key] };
    setPerms(next);
    const result = await updateAiPermissionsAction(next);
    if (!result.ok) {
      setPerms(perms);
      setMessage({ tone: "error", text: result.error });
    }
  };

  const savePermissions = async () => {
    setPending("permissions");
    const result = await updateAiPermissionsAction(perms);
    setPending(null);
    setMessage(
      result.ok
        ? { tone: "success", text: "AI access updated. Disabled modules are never sent as context." }
        : { tone: "error", text: result.error },
    );
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("password");
    setMessage(null);
    const result = await changePasswordAction(passwords);
    setPending(null);
    if (result.ok) {
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage({ tone: "success", text: "Password changed. Other devices were signed out." });
    } else {
      setMessage({ tone: "error", text: result.error });
    }
    router.refresh();
  };

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const doExportJson = async () => {
    setPending("json");
    setMessage(null);
    const result = await exportJsonAction();
    setPending(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    download(result.data.filename, result.data.content, "application/json");
    setMessage({ tone: "success", text: `Exported ${result.data.rows} rows as JSON.` });
  };

  const doExportCsv = async (table: string) => {
    setPending(`csv-${table}`);
    const result = await exportCsvAction(table);
    setPending(null);
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    if (!result.data.content) {
      setMessage({ tone: "error", text: `${table} has no rows yet.` });
      return;
    }
    download(result.data.filename, result.data.content, "text/csv");
  };

  const loadSessions = async () => {
    setPending("sessions");
    const result = await listSessionsAction();
    setPending(null);
    if (result.ok) setSessionList(result.data);
    else setMessage({ tone: "error", text: result.error });
  };

  const signOutEverywhere = async () => {
    setPending("everywhere");
    const result = await logoutEverywhereAction();
    if (result.ok) router.replace(result.data.redirectTo);
  };

  return (
    <div className="space-y-4">
      {message ? <Alert variant={message.tone}>{message.text}</Alert> : null}

      <Card>
        <CardHeader title="Profile" subtitle="How the app addresses you and reads your clock" />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={profile.fullName} onChange={(event) => setProfile((p) => ({ ...p, fullName: event.target.value }))} />
          </Field>
          <Field label="Timezone" hint="Used for every date boundary: today, this week, reminders.">
            <Input value={profile.timezone} onChange={(event) => setProfile((p) => ({ ...p, timezone: event.target.value }))} />
          </Field>
          <Field label="Theme">
            <Select
              value={profile.theme}
              onChange={(event) => setProfile((p) => ({ ...p, theme: event.target.value as "light" | "dark" | "system" }))}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </Field>
          <Field label="Week starts on">
            <Select value={profile.weekStartsOn} onChange={(event) => setProfile((p) => ({ ...p, weekStartsOn: event.target.value }))}>
              <option value="6">Saturday</option>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button size="sm" onClick={saveProfile} loading={pending === "profile"}>
            <Save className="h-3.5 w-3.5" />
            Save profile
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Privacy &amp; AI access"
          subtitle="The advisor can only read what is switched on here"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <ul className="divide-y divide-border">
          {PERMISSION_LABELS.map((item) => (
            <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {item.label}
                  {item.sensitive ? <span className="ml-2 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">sensitive</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground">{item.hint}</p>
              </div>
              <button
                onClick={() => togglePermission(item.key)}
                role="switch"
                aria-checked={Boolean(perms[item.key])}
                aria-label={`Toggle ${item.label}`}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  perms[item.key] ? "bg-accent" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
                    perms[item.key] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button size="sm" onClick={savePermissions} loading={pending === "permissions"}>
            Save AI access
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Password" subtitle="Changing it signs out every other device" icon={<KeyRound className="h-4 w-4" />} />
          <form onSubmit={changePassword} className="space-y-3 px-4 py-3">
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords((p) => ({ ...p, currentPassword: event.target.value }))}
              />
            </Field>
            <Field label="New password" hint="At least 8 characters with upper, lower and a number.">
              <Input
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(event) => setPasswords((p) => ({ ...p, newPassword: event.target.value }))}
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={(event) => setPasswords((p) => ({ ...p, confirmPassword: event.target.value }))}
              />
            </Field>
            <Button type="submit" size="sm" full loading={pending === "password"}>
              Change password
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Data &amp; backup"
            subtitle="Take everything with you — you are never locked in"
            icon={<Download className="h-4 w-4" />}
          />
          <div className="space-y-2 px-4 py-3">
            <Button variant="secondary" full onClick={doExportJson} loading={pending === "json"}>
              <Download className="h-4 w-4" />
              Download full JSON export
            </Button>
            <div className="grid grid-cols-2 gap-2">
              {csvTables.map((table) => (
                <Button
                  key={table}
                  size="sm"
                  variant="outline"
                  onClick={() => doExportCsv(table)}
                  loading={pending === `csv-${table}`}
                >
                  {table.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The JSON export contains every row you own. Password hashes and session tokens are never included.
              Restore by importing the file into a fresh database, or keep it as an offline backup.
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Sessions"
          subtitle="Active sign-ins on this account"
          action={
            <Button size="sm" variant="ghost" onClick={loadSessions} loading={pending === "sessions"}>
              Refresh
            </Button>
          }
        />
        {sessionList.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted-foreground">Load the list to see where you are signed in.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sessionList.map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{session.userAgent ?? "Unknown device"}</span>
                <span className="shrink-0">{session.current ? "this device" : new Date(session.expiresAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Button size="sm" variant="danger" onClick={signOutEverywhere} loading={pending === "everywhere"}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out everywhere
          </Button>
        </div>
      </Card>
    </div>
  );
}
