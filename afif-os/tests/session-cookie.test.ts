import { describe, expect, it } from "vitest";
import { resolveCookieAttributes, resolveCookieSecure } from "@/server/auth/session";

/**
 * Session-cookie transport attributes.
 *
 * Two failure modes are pinned here, both of which present as a login that
 * appears to succeed and then bounces back to /login:
 *
 * - A `Secure` cookie delivered over plain http is silently discarded by the
 *   browser, so no session ever arrives.
 * - A `SameSite=Lax` cookie is never sent inside a cross-site iframe. The
 *   browser stores it, then omits it from every framed request, so the guard
 *   sees an anonymous visitor. Embedded previews need `SameSite=None`, which
 *   itself requires `Secure`.
 */

const base = {
  secureOverride: null,
  sameSiteOverride: null,
  forwardedProto: null,
  secFetchSite: null,
  secFetchDest: null,
  nodeEnv: "development",
};

describe("resolveCookieAttributes — Secure follows the wire protocol", () => {
  it("is not secure for a production build served over plain http", () => {
    expect(
      resolveCookieAttributes({ ...base, nodeEnv: "production", forwardedProto: "http" }).secure,
    ).toBe(false);
  });

  it("is secure behind an https proxy regardless of build mode", () => {
    expect(resolveCookieAttributes({ ...base, forwardedProto: "https" }).secure).toBe(true);
    expect(
      resolveCookieAttributes({ ...base, nodeEnv: "production", forwardedProto: "https" }).secure,
    ).toBe(true);
  });

  it("honours the first entry of a comma-separated forwarded chain", () => {
    expect(resolveCookieAttributes({ ...base, forwardedProto: "https, http" }).secure).toBe(true);
    expect(resolveCookieAttributes({ ...base, forwardedProto: "http, https" }).secure).toBe(false);
  });

  it("lets COOKIE_SECURE override either way", () => {
    expect(
      resolveCookieAttributes({ ...base, secureOverride: "true", forwardedProto: "http" }).secure,
    ).toBe(true);
    expect(
      resolveCookieAttributes({ ...base, secureOverride: "false", forwardedProto: "https" }).secure,
    ).toBe(false);
  });
});

describe("resolveCookieAttributes — SameSite follows the embedding context", () => {
  it("uses lax for a top-level document navigation", () => {
    expect(
      resolveCookieAttributes({ ...base, secFetchSite: "none", secFetchDest: "document" }).sameSite,
    ).toBe("lax");
    expect(resolveCookieAttributes({ ...base, secFetchSite: "same-origin" }).sameSite).toBe("lax");
  });

  it("uses none inside a cross-site iframe so the cookie is actually sent", () => {
    // This is the hosted-preview case: framed by another origin.
    expect(
      resolveCookieAttributes({
        ...base,
        forwardedProto: "https",
        secFetchSite: "cross-site",
        secFetchDest: "iframe",
      }).sameSite,
    ).toBe("none");
  });

  it("treats a same-site frame as embedded too", () => {
    expect(
      resolveCookieAttributes({
        ...base,
        forwardedProto: "https",
        secFetchSite: "same-site",
        secFetchDest: "iframe",
      }).sameSite,
    ).toBe("none");
  });

  it("lets COOKIE_SAMESITE override detection", () => {
    expect(
      resolveCookieAttributes({
        ...base,
        sameSiteOverride: "none",
        forwardedProto: "https",
        secFetchSite: "same-origin",
      }).sameSite,
    ).toBe("none");
    expect(
      resolveCookieAttributes({
        ...base,
        sameSiteOverride: "lax",
        forwardedProto: "https",
        secFetchSite: "cross-site",
        secFetchDest: "iframe",
      }).sameSite,
    ).toBe("lax");
  });
});

describe("resolveCookieAttributes — never emits an invalid combination", () => {
  it("upgrades Secure when SameSite=None over https", () => {
    // Browsers reject SameSite=None without Secure outright.
    const attrs = resolveCookieAttributes({
      ...base,
      sameSiteOverride: "none",
      forwardedProto: "https",
      secureOverride: null,
    });
    expect(attrs).toEqual({ secure: true, sameSite: "none" });
  });

  it("falls back to lax rather than emit SameSite=None without Secure", () => {
    // Over plain http we cannot satisfy None, so Lax is the only valid choice.
    const attrs = resolveCookieAttributes({
      ...base,
      sameSiteOverride: "none",
      forwardedProto: "http",
      secureOverride: "false",
    });
    expect(attrs).toEqual({ secure: false, sameSite: "lax" });
  });

  it("never returns none without secure for any input combination", () => {
    const protos = [null, "http", "https"];
    const sites = [null, "none", "same-origin", "same-site", "cross-site"];
    const dests = [null, "document", "iframe"];
    const overrides = [null, "true", "false"];
    for (const forwardedProto of protos) {
      for (const secFetchSite of sites) {
        for (const secFetchDest of dests) {
          for (const secureOverride of overrides) {
            const attrs = resolveCookieAttributes({
              ...base,
              forwardedProto,
              secFetchSite,
              secFetchDest,
              secureOverride,
            });
            expect(attrs.sameSite === "none" ? attrs.secure : true).toBe(true);
          }
        }
      }
    }
  });
});

describe("resolveCookieSecure (back-compat wrapper)", () => {
  it("agrees with resolveCookieAttributes", () => {
    expect(resolveCookieSecure({ override: null, forwardedProto: "https", nodeEnv: "development" })).toBe(
      true,
    );
    expect(resolveCookieSecure({ override: null, forwardedProto: null, nodeEnv: "development" })).toBe(
      false,
    );
  });
});
