"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/server/auth/actions";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";

const REASON_MESSAGES: Record<string, string> = {
  auth_required: "Your session expired or you are not signed in.",
  logged_out: "You have been signed out.",
  setup_complete: "Account created. You are signed in.",
};

export function LoginForm({
  reason,
  next,
  needsSetup,
}: {
  reason?: string;
  next?: string;
  needsSetup: boolean;
}) {
  const router = useRouter();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [reveal, setReveal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    try {
      const result = await loginAction({ identifier, password, remember });
      if (result.ok) {
        const target = next && next.startsWith("/") ? next : result.data.redirectTo;
        router.replace(target);
        router.refresh();
        // Leave `pending` set: the navigation is about to unmount this form, and
        // flashing the button back to "Sign in" on the way out looks like a
        // failure. Every non-navigating path below must clear it.
        return;
      }
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setPending(false);
    } catch {
      // `loginAction` rejects when the request itself fails — a stale build
      // serving "Server action not found", a dropped network connection, or an
      // unhandled server error. Without this the button would sit on
      // "Signing in…" forever and the user would have no way to retry.
      setError(
        "The sign-in request did not complete. This usually means the server was restarted or redeployed — reload this page and try again.",
      );
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h2 className="text-base font-semibold tracking-tight">Sign in</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {reason && REASON_MESSAGES[reason] ? REASON_MESSAGES[reason] : "Welcome back."}
        </p>
      </div>

      {needsSetup ? (
        <Alert variant="warning" title="No account yet">
          This is a fresh install. Create your account first — it takes a few seconds.
          <Link href="/setup" className="mt-1.5 block font-medium text-primary underline underline-offset-2">
            Create the first account
          </Link>
        </Alert>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Field label="Email or username" error={fieldErrors.identifier} required>
        <Input
          name="identifier"
          autoComplete="username"
          autoFocus
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="afif"
          required
        />
      </Field>

      <Field label="Password" error={fieldErrors.password} required>
        <div className="relative">
          <Input
            name="password"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
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

      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
          className="h-4 w-4 rounded border-border bg-card accent-primary"
        />
        Remember me for 30 days
      </label>

      <Button type="submit" full loading={pending} disabled={pending}>
        {!pending ? <LogIn className="h-4 w-4" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
