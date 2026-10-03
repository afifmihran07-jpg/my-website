"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/server/auth/actions";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
// TEMPORARY DIAGNOSTIC — remove with src/components/auth/CookieDiagnostics.tsx
import { CookieDiagnostics } from "./CookieDiagnostics";

/**
 * Does the browser hold a working session cookie right now?
 *
 * `document.cookie` cannot answer this: the session cookie is HttpOnly and so
 * invisible to script by design. Instead ask an endpoint that is genuinely
 * authenticated — it returns 200 only when a valid session cookie arrives.
 * Any failure is treated as "not working", since that is the state we need to
 * report and a network error would block the dashboard anyway.
 */
async function sessionCookieWorks(): Promise<boolean> {
  try {
    const response = await fetch("/api/study/active", {
      credentials: "same-origin",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

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
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [reveal, setReveal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [pending, setPending] = React.useState(false);
  // Set when the server accepted the credentials but the browser did not keep
  // the session cookie. Distinct from a wrong password: retrying cannot help.
  const [cookieBlocked, setCookieBlocked] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    setCookieBlocked(false);

    // Hard ceiling on the pending state. A successful login navigates away and
    // unmounts this form; if that navigation never settles the button would
    // otherwise read "Signing in…" forever with no way out. This clears it
    // and says so instead of leaving the user guessing.
    const watchdog = window.setTimeout(() => {
      setPending(false);
      setError(
        "Sign-in succeeded but the page did not finish loading. Reload the page — you should already be signed in.",
      );
    }, 15_000);

    try {
      const result = await loginAction({ identifier, password, remember });
      if (result.ok) {
        const target = next && next.startsWith("/") ? next : result.data.redirectTo;
        window.clearTimeout(watchdog);

        // Confirm the browser actually kept the session cookie before hopping.
        //
        // When this app is framed by another origin the session cookie is a
        // third-party cookie, and a browser that blocks those will accept the
        // Set-Cookie and then store nothing. Navigating anyway lands on
        // /dashboard with no session, which immediately redirects back here --
        // an endless "Signing in…" -> blank -> login loop with no explanation.
        //
        // So probe an authenticated endpoint first. On success this costs one
        // fast request; on failure it turns a silent loop into a message that
        // says what is wrong and what to do about it.
        if (!(await sessionCookieWorks())) {
          setCookieBlocked(true);
          setPending(false);
          return;
        }

        // Full-document navigation, not a client-side route change.
        //
        // This deliberately bypasses the App Router for the post-login hop.
        // `router.replace()` leaves the current component mounted until the
        // router commits the new tree, so any unresolved navigation keeps this
        // form on screen reading "Signing in…" — which is exactly the
        // failure being fixed here (a `router.refresh()` used to race it to the
        // same destination). Assigning to location unloads the document, so the
        // button cannot survive the transition, and the server renders
        // /dashboard fresh with the new session cookie.
        window.location.assign(target);
        return;
      }
      window.clearTimeout(watchdog);
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setPending(false);
    } catch {
      window.clearTimeout(watchdog);
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

      {cookieBlocked ? (
        <Alert variant="warning" title="Your browser blocked the session cookie">
          The password was correct and the server signed you in, but this browser
          refused to keep the session cookie — so every page would bounce straight
          back here.
          <span className="mt-1.5 block">
            This happens when the app is displayed inside a frame on another
            website and your browser blocks third-party cookies. Opening it
            directly in its own tab makes the cookie first-party, which works.
          </span>
          <Button
            type="button"
            variant="secondary"
            className="mt-2"
            onClick={() => window.open(window.location.href, "_blank", "noopener")}
          >
            Open in a new tab
          </Button>
        </Alert>
      ) : null}

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

      {/* TEMPORARY DIAGNOSTIC — remove with CookieDiagnostics.tsx */}
      <CookieDiagnostics />

      <Button type="submit" full loading={pending} disabled={pending}>
        {!pending ? <LogIn className="h-4 w-4" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
