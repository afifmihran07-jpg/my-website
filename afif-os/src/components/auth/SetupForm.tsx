"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { setupAccountAction } from "@/server/auth/actions";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";

const RULES = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "lower", label: "A lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "upper", label: "An uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "digit", label: "A number", test: (v: string) => /[0-9]/.test(v) },
];

export function SetupForm() {
  const [form, setForm] = React.useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [reveal, setReveal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    // Hard ceiling on the pending state, matching the login form.
    const watchdog = window.setTimeout(() => {
      setPending(false);
      setError(
        "The account was created but the page did not finish loading. Reload the page — you should already be signed in.",
      );
    }, 15_000);

    try {
      const result = await setupAccountAction(form);
      if (result.ok) {
        window.clearTimeout(watchdog);
        // Full-document navigation for the same reason as the login form: it
        // unloads this page, so the button cannot survive an unresolved
        // client-side navigation.
        window.location.assign(result.data.redirectTo);
        return;
      }
      window.clearTimeout(watchdog);
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setPending(false);
    } catch {
      // Same guard as the login form: a rejected action would otherwise leave
      // the button spinning forever with no way to retry.
      window.clearTimeout(watchdog);
      setError(
        "The request did not complete. This usually means the server was restarted or redeployed — reload this page and try again.",
      );
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h2 className="text-base font-semibold tracking-tight">Create your account</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          This is the one-time setup for your personal OS. It can only be completed once.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Field label="Full name" error={fieldErrors.fullName} required>
        <Input name="fullName" value={form.fullName} onChange={set("fullName")} autoComplete="name" required autoFocus />
      </Field>

      <Field label="Username" error={fieldErrors.username} hint="Lowercase letters, numbers, dots and underscores." required>
        <Input name="username" value={form.username} onChange={set("username")} autoComplete="username" required />
      </Field>

      <Field label="Email" error={fieldErrors.email} required>
        <Input name="email" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
      </Field>

      <Field label="Password" error={fieldErrors.password} required>
        <div className="relative">
          <Input
            name="password"
            type={reveal ? "text" : "password"}
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/40 p-2.5">
        {RULES.map((rule) => {
          const passed = rule.test(form.password);
          return (
            <li
              key={rule.id}
              className={`flex items-center gap-1.5 text-[11px] ${passed ? "text-accent" : "text-muted-foreground"}`}
            >
              {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {rule.label}
            </li>
          );
        })}
      </ul>

      <Field label="Confirm password" error={fieldErrors.confirmPassword} required>
        <Input
          name="confirmPassword"
          type={reveal ? "text" : "password"}
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" full loading={pending} disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Already set up?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
