"use client";

import * as React from "react";

/**
 * TEMPORARY DIAGNOSTIC PANEL — delete once the login loop is resolved.
 *
 * Bump on every change: several rounds of fixes were tested against a preview
 * that was not serving the code under test, which made every result
 * uninterpretable.
 */
export const BUILD_STAMP = "diag-3";

const TEST_COOKIE = "afif_cookie_probe";

/** The attribute set the real session cookie uses, so the probe tests the same thing. */
const PROBE_ATTRS = "path=/; SameSite=None; Secure; Max-Age=60";

export type EnvironmentReport = {
  origin: string;
  href: string;
  framed: boolean;
  framedDetail: string;
  referrer: string;
  secureContext: boolean;
  cookieWriteOk: boolean;
  cookieDetail: string;
  hasStorageAccess: boolean | "unsupported";
  storageAccessSupported: boolean;
};

/**
 * Can this document store a cookie at all?
 *
 * The session cookie is HttpOnly and therefore invisible to script, so it
 * cannot be inspected directly. A deliberately non-HttpOnly probe cookie can
 * be, and it is written with the SAME attributes the session cookie uses. If
 * the browser refuses this one, it is refusing cookies in this browsing
 * context entirely — which no server-side SameSite / Secure / Partitioned
 * setting can override.
 *
 * The probe carries no data and is deleted immediately.
 */
function probeCookieWrite(): { ok: boolean; detail: string } {
  try {
    document.cookie = `${TEST_COOKIE}=1; ${PROBE_ATTRS}`;
    const stored = document.cookie
      .split(";")
      .some((pair) => pair.trim().startsWith(`${TEST_COOKIE}=`));
    document.cookie = `${TEST_COOKIE}=; path=/; Max-Age=0`;

    return stored
      ? { ok: true, detail: `stored and read back with [${PROBE_ATTRS}]` }
      : {
          ok: false,
          detail: `browser REFUSED a cookie with [${PROBE_ATTRS}] — cookie storage is blocked in this context`,
        };
  } catch (error) {
    return { ok: false, detail: `cookie access threw: ${String(error)}` };
  }
}

export function inspectEnvironment(): EnvironmentReport {
  // Reading window.top throws when the frame is cross-origin; the throw is
  // itself the answer.
  let framed = false;
  let framedDetail = "top-level (not framed)";
  try {
    framed = window.self !== window.top;
    if (framed) {
      // Only readable when same-origin; a throw means cross-origin embedding.
      void window.top?.location.href;
      framedDetail = "iframe, same-origin as parent";
    }
  } catch {
    framed = true;
    framedDetail = "iframe, CROSS-ORIGIN parent (cookies are third-party here)";
  }

  const write = probeCookieWrite();

  // The Storage Access API is the sanctioned way for an embedded page to ask
  // the user for its own cookies back.
  const storageAccessSupported = typeof document.hasStorageAccess === "function";
  let hasStorageAccess: boolean | "unsupported" = "unsupported";
  if (storageAccessSupported) {
    // Synchronous best-effort read; the authoritative check is awaited by the
    // caller before a login attempt.
    hasStorageAccess = false;
  }

  return {
    origin: window.location.origin,
    href: window.location.href,
    framed,
    framedDetail,
    referrer: document.referrer || "(none)",
    secureContext: window.isSecureContext,
    cookieWriteOk: write.ok,
    cookieDetail: write.detail,
    hasStorageAccess,
    storageAccessSupported,
  };
}

export function CookieDiagnostics({
  trace,
}: {
  trace?: { stage: string; detail: string; ok: boolean | null }[];
}) {
  const [env, setEnv] = React.useState<EnvironmentReport | null>(null);
  const [access, setAccess] = React.useState<boolean | "unsupported" | "checking">("checking");

  React.useEffect(() => {
    const report = inspectEnvironment();
    setEnv(report);

    if (typeof document.hasStorageAccess === "function") {
      document
        .hasStorageAccess()
        .then((granted) => setAccess(granted))
        .catch(() => setAccess("unsupported"));
    } else {
      setAccess("unsupported");
    }
  }, []);

  // Rendered unconditionally: the build stamp has to be present in the server
  // HTML, otherwise a stale build looks identical to a current one.
  const cookieColour = !env
    ? "text-muted-foreground"
    : env.cookieWriteOk
      ? "text-emerald-600"
      : "text-red-600";

  return (
    <div
      data-testid="cookie-diagnostics"
      className="mt-4 rounded-md border border-dashed border-border bg-muted/40 p-2.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground"
    >
      <div className="mb-1 font-sans text-[11px] font-semibold text-foreground">
        Sign-in diagnostics (temporary — please report these lines)
      </div>
      <div>build: {BUILD_STAMP}</div>
      <div>origin: {env ? env.origin : "checking…"}</div>
      <div>secureContext: {env ? String(env.secureContext) : "checking…"}</div>
      <div>framed: {env ? env.framedDetail : "checking…"}</div>
      <div className="break-all">referrer: {env ? env.referrer : "checking…"}</div>
      <div>
        storageAccess: {access === "checking" ? "checking…" : String(access)}
        {env && !env.storageAccessSupported ? " (API unsupported)" : ""}
      </div>
      <div className={`break-words ${cookieColour}`}>
        cookieWrite:{" "}
        {!env ? "checking…" : `${env.cookieWriteOk ? "PASS" : "FAIL"} — ${env.cookieDetail}`}
      </div>

      {trace && trace.length > 0 ? (
        <div className="mt-1.5 border-t border-border pt-1.5">
          <div className="mb-0.5 font-sans text-[11px] font-semibold text-foreground">
            Login trace
          </div>
          {trace.map((step) => (
            <div key={step.stage} className="break-words">
              {step.ok === null ? "…" : step.ok ? "PASS" : "FAIL"} {step.stage} — {step.detail}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
