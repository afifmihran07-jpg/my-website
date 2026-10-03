"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/server/auth/actions";
import { Alert, Button, Field, Input } from "@/components/ui/primitives";
// TEMPORARY DIAGNOSTIC — remove with src/components/auth/CookieDiagnostics.tsx
import { CookieDiagnostics } from "./CookieDiagnostics";

type SessionProbe =
  | { state: "no-cookie"; detail: string }
  | { state: "unresolved"; detail: string }
  | { state: "authenticated"; detail: string }
  | { state: "error"; detail: string };

/**
 * Ask the server what it actually received, so the two failure modes that look
 * identical from here can be told apart.
 *
 * `document.cookie` cannot be used: the session cookie is HttpOnly and so
 * invisible to script by design. So the server reports whether a cookie
 * ARRIVED and whether it RESOLVED. "Did not arrive" means the browser refused
 * to store or send it; "arrived but did not resolve" is a server-side session
 * problem. Those have completely different fixes.
 */
async function probeSession(): Promise<SessionProbe> {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      return { state: "error", detail: `/api/auth/session returned ${response.status}` };
    }
    const body = (await response.json()) as {
      cookiePresented?: boolean;
      sessionResolved?: boolean;
      authenticated?: boolean;
      cookieNames?: string[];
    };

    if (body.authenticated) {
      return { state: "authenticated", detail: "cookie sent, session resolved" };
    }
    if (body.cookiePresented) {
      return {
        state: "unresolved",
        detail: "cookie WAS sent but the server could not resolve a session from it",
      };
    }
    return {
      state: "no-cookie",
      detail: `no session cookie reached the server (cookies seen: ${(body.cookieNames ?? []).join(",") || "none"})`,
    };
  } catch (error) {
    return { state: "error", detail: `probe threw: ${String(error)}` };
  }
}

/**
 * Ask the browser to unblock this frame's own cookies.
 *
 * This is the Storage Access API: the sanctioned mechanism for an embedded
 * cross-site page to request its cookies back, gated on an explicit user
 * gesture and the browser's own permission prompt. It changes nothing about
 * how authentication works — the session is still an HttpOnly cookie, still
 * verified server-side. It only asks the browser to stop withholding it.
 *
 * Returns null when the API is unavailable, so the caller can fall back.
 */
async function requestCookieAccess(): Promise<boolean | null> {
  if (typeof document.requestStorageAccess !== "function") return null;
  try {
    await document.requestStorageAccess();
    return true;
  } catch {
    // The user declined, or the browser refused. Not an error to surface as one.
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
  // TEMPORARY DIAGNOSTIC — the stage-by-stage trace shown in the panel.
  const [trace, setTrace] = React.useState<{ stage: string; detail: string; ok: boolean | null }[]>(
    [],
  );
  const [accessBusy, setAccessBusy] = React.useState(false);

  const stage = React.useCallback(
    (name: string, detail: string, ok: boolean | null) =>
      setTrace((prev) => [...prev.filter((s) => s.stage !== name), { stage: name, detail, ok }]),
    [],
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    setCookieBlocked(false);
    setTrace([]);

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
      // Stage A/B: did the request reach the server, and did it authenticate?
      stage("A request reached server", "server action returned a response", true);

      if (result.ok) {
        const target = next && next.startsWith("/") ? next : result.data.redirectTo;
        window.clearTimeout(watchdog);
        stage("B credentials accepted", "session created server-side", true);

        // Confirm the browser actually kept the session cookie before hopping.
        //
        // When this app is framed by another origin the session cookie is a
        // third-party cookie, and a browser that blocks those will accept the
        // Set-Cookie and then store nothing. Navigating anyway lands on
        // /dashboard with no session, which immediately redirects back here --
        // an endless "Signing in…" -> blank -> login loop with no explanation.
        //
        // So probe first. On success this costs one fast request; on failure it
        // turns a silent loop into a message naming the exact stage that broke.
        const probe = await probeSession();
        if (probe.state === "no-cookie") {
          stage("C Set-Cookie rejected by browser", probe.detail, false);
          setCookieBlocked(true);
          setPending(false);
          return;
        }
        if (probe.state === "unresolved") {
          stage("E cookie sent but session unresolved", probe.detail, false);
          setError(
            "Your browser sent the session cookie but the server could not match it to a session. Try signing in again.",
          );
          setPending(false);
          return;
        }
        if (probe.state === "error") {
          stage("D probe failed", probe.detail, false);
          setError(
            "Sign-in succeeded but the app could not confirm the session. Reload and try again.",
          );
          setPending(false);
          return;
        }
        stage("D cookie sent back", probe.detail, true);

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
      stage("B credentials accepted", result.error, false);
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setPending(false);
    } catch (error) {
      window.clearTimeout(watchdog);
      stage("A request reached server", `request failed: ${String(error)}`, false);
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
        <Alert variant="warning" title="This browser is blocking the sign-in cookie">
          Your password was correct and the server created your session, but this
          browser refuses to store the session cookie — so every page would bounce
          straight back here. Nothing is wrong with your account.
          <span className="mt-1.5 block">
            The app is running inside a frame on another site, which makes its
            cookie a third-party cookie. Your browser is blocking those. Two ways
            forward, neither of which weakens how you are authenticated:
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              loading={accessBusy}
              disabled={accessBusy}
              onClick={async () => {
                // Must be called from a user gesture, which this click is.
                setAccessBusy(true);
                const granted = await requestCookieAccess();
                setAccessBusy(false);
                if (granted) {
                  // The browser released the cookies; the session the server
                  // already created is still valid, so go straight through.
                  const probe = await probeSession();
                  if (probe.state === "authenticated") {
                    window.location.assign("/dashboard");
                    return;
                  }
                }
                setError(
                  granted
                    ? "Access was granted but the session still did not come through. Please use “Open in a new tab”."
                    : "The browser did not grant cookie access. Please use “Open in a new tab” — that puts the app in its own tab where the cookie is first-party.",
                );
              }}
            >
              Allow cookies for this frame
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.open(window.location.href, "_blank", "noopener")}
            >
              Open in a new tab
            </Button>
          </div>
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
      <CookieDiagnostics trace={trace} />

      <Button type="submit" full loading={pending} disabled={pending}>
        {!pending ? <LogIn className="h-4 w-4" /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
