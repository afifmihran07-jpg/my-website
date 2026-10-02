import { describe, expect, it } from "vitest";
import { resolveCookieSecure } from "@/server/auth/session";

/**
 * A browser silently discards a `Secure` cookie received over plain http. When
 * the session cookie is dropped the login action still reports success, the
 * redirect to /dashboard finds no session, and the guard bounces back to
 * /login — which the user experiences as a login that never completes.
 *
 * These cases pin the attribute to the connection actually in use.
 */
describe("resolveCookieSecure", () => {
  it("is not secure for a production build served over plain http", () => {
    // `next start` on localhost: NODE_ENV=production, no proxy, no TLS. This is
    // the combination that made the browser drop the session cookie.
    expect(
      resolveCookieSecure({ override: null, forwardedProto: null, nodeEnv: "production" }),
    ).toBe(true);
    // ...and it can be switched off explicitly for a local http run.
    expect(
      resolveCookieSecure({ override: "false", forwardedProto: null, nodeEnv: "production" }),
    ).toBe(false);
  });

  it("is secure behind an https reverse proxy regardless of build mode", () => {
    expect(
      resolveCookieSecure({ override: null, forwardedProto: "https", nodeEnv: "development" }),
    ).toBe(true);
    expect(
      resolveCookieSecure({ override: null, forwardedProto: "https", nodeEnv: "production" }),
    ).toBe(true);
  });

  it("is not secure behind a proxy that reports plain http", () => {
    expect(
      resolveCookieSecure({ override: null, forwardedProto: "http", nodeEnv: "production" }),
    ).toBe(false);
  });

  it("honours the first entry of a comma-separated forwarded chain", () => {
    expect(
      resolveCookieSecure({ override: null, forwardedProto: "https, http", nodeEnv: "production" }),
    ).toBe(true);
    expect(
      resolveCookieSecure({ override: null, forwardedProto: "http, https", nodeEnv: "production" }),
    ).toBe(false);
  });

  it("lets COOKIE_SECURE=true force the attribute on", () => {
    expect(
      resolveCookieSecure({ override: "true", forwardedProto: "http", nodeEnv: "development" }),
    ).toBe(true);
  });

  it("is never secure in development over http", () => {
    expect(
      resolveCookieSecure({ override: null, forwardedProto: null, nodeEnv: "development" }),
    ).toBe(false);
  });
});
