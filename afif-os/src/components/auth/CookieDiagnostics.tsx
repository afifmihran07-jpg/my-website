"use client";

import * as React from "react";

/**
 * TEMPORARY DIAGNOSTIC PANEL — delete once the login loop is resolved.
 *
 * Bump this on every change so it is obvious which build is actually running in
 * the browser. Several rounds of fixes were tested against a preview that was
 * not serving the code under test, which made every result uninterpretable.
 */
const BUILD_STAMP = "diag-2";

const TEST_COOKIE = "afif_cookie_probe";

type CookieProbe =
  | { state: "running" }
  | { state: "pass"; detail: string }
  | { state: "fail"; detail: string };

/**
 * Can this document store a cookie at all?
 *
 * This is the question every previous round of debugging could not answer. The
 * session cookie is HttpOnly, so it is invisible to script and cannot be
 * inspected. But a separate, deliberately NON-HttpOnly probe cookie can be: if
 * the browser refuses to store that one, it is refusing cookies in this
 * browsing context entirely — which is exactly what third-party cookie blocking
 * does to an app inside a cross-site iframe, and no amount of SameSite, Secure
 * or Partitioned tuning on the server can override it.
 *
 * The probe carries no data and is deleted immediately.
 */
function probeCookieStorage(): CookieProbe {
  const attrs = "path=/; SameSite=None; Secure; Max-Age=60";
  try {
    document.cookie = `${TEST_COOKIE}=1; ${attrs}`;
    const stored = document.cookie
      .split(";")
      .some((pair) => pair.trim().startsWith(`${TEST_COOKIE}=`));

    // Clean up regardless of the outcome.
    document.cookie = `${TEST_COOKIE}=; path=/; Max-Age=0`;

    if (stored) {
      return { state: "pass", detail: "browser stored a SameSite=None; Secure cookie" };
    }
    return {
      state: "fail",
      detail:
        "browser REFUSED to store a SameSite=None; Secure cookie — cookies are blocked in this context",
    };
  } catch (error) {
    return { state: "fail", detail: `cookie access threw: ${String(error)}` };
  }
}

export function CookieDiagnostics() {
  const [probe, setProbe] = React.useState<CookieProbe>({ state: "running" });
  const [framed, setFramed] = React.useState<string>("checking…");

  React.useEffect(() => {
    // Reading window.top throws when the frame is cross-origin, which is itself
    // the answer: the app is embedded under a different site.
    let embedded: string;
    try {
      embedded = window.self === window.top ? "no (top-level tab)" : "yes (cross-origin iframe)";
    } catch {
      embedded = "yes (cross-origin iframe)";
    }
    setFramed(embedded);
    setProbe(probeCookieStorage());
  }, []);

  const colour =
    probe.state === "pass"
      ? "text-emerald-600"
      : probe.state === "fail"
        ? "text-red-600"
        : "text-muted-foreground";

  return (
    <div
      data-testid="cookie-diagnostics"
      className="mt-4 rounded-md border border-dashed border-border bg-muted/40 p-2.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground"
    >
      <div className="mb-1 font-sans text-[11px] font-semibold text-foreground">
        Sign-in diagnostics (temporary — please report these lines)
      </div>
      <div>build: {BUILD_STAMP}</div>
      <div>framed: {framed}</div>
      <div className={colour}>
        cookies: {probe.state === "running" ? "testing…" : `${probe.state.toUpperCase()} — ${probe.detail}`}
      </div>
    </div>
  );
}
