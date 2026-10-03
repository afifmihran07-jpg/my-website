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
    expect(attrs).toEqual({ secure: true, sameSite: "none", partitioned: true });
  });

  it("falls back to lax rather than emit SameSite=None without Secure", () => {
    // Over plain http we cannot satisfy None, so Lax is the only valid choice.
    const attrs = resolveCookieAttributes({
      ...base,
      sameSiteOverride: "none",
      forwardedProto: "http",
      secureOverride: "false",
    });
    expect(attrs).toEqual({ secure: false, sameSite: "lax", partitioned: false });
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

/**
 * Regression test for the login redirect loop behind a hosted preview.
 *
 * Reproduced from a real request captured in the server logs:
 *   GET / | x-forwarded-host == host | x-forwarded-proto=http | Sec-Fetch-* absent
 *
 * The preview terminates TLS itself and forwards plain http to the app while
 * stripping every Sec-Fetch-* header. So `secure` derived to false and the
 * auto-detection of an embedded context could not fire. With
 * COOKIE_SAMESITE="none" set, the old guard still collapsed the attribute to
 * Lax, because it refused SameSite=None without Secure.
 *
 * A Lax cookie is stored by the browser but never sent inside a cross-site
 * iframe, so /dashboard saw no session cookie and bounced back to /login —
 * which looks exactly like a login that succeeds and immediately fails.
 */
describe("hosted preview: x-forwarded-proto=http with Sec-Fetch-* stripped", () => {
  const realPreview = {
    forwardedProto: "http",
    secFetchSite: null,
    secFetchDest: null,
    secFetchMode: null,
    nodeEnv: "development",
  };

  it("keeps SameSite=None when it was explicitly requested, promoting Secure", () => {
    const attrs = resolveCookieAttributes({ ...realPreview, sameSiteOverride: "none" });
    expect(attrs).toEqual({ secure: true, sameSite: "none", partitioned: true });
  });

  it("still honours an explicit Secure=false, falling back to Lax", () => {
    // An operator who turns Secure off cannot get None — browsers would drop
    // it outright — so Lax is the only survivable answer.
    const attrs = resolveCookieAttributes({
      ...realPreview,
      sameSiteOverride: "none",
      secureOverride: "false",
    });
    expect(attrs).toEqual({ secure: false, sameSite: "lax", partitioned: false });
  });

  it("leaves the auto-detected path on Lax over plain http", () => {
    // No override: nothing says this is a cross-site frame, so do not upgrade.
    const attrs = resolveCookieAttributes({ ...realPreview, sameSiteOverride: null });
    expect(attrs).toEqual({ secure: false, sameSite: "lax", partitioned: false });
  });
});

/**
 * The exact headers captured from the real browser hitting the hosted preview,
 * with no environment override set at all. This is the case that produced the
 * redirect loop: x-forwarded-proto says http because the proxy terminates TLS
 * before forwarding, while Sec-Fetch-* correctly report a cross-site iframe.
 *
 * Before the fix this resolved to SameSite=Lax, which the browser stores but
 * never sends inside a cross-site iframe.
 */
describe("captured preview navigation headers, no env override", () => {
  const captured = {
    forwardedProto: "http",
    secFetchSite: "cross-site",
    secFetchDest: "iframe",
    secureOverride: null,
    sameSiteOverride: null,
    nodeEnv: "development",
  };

  it("resolves to SameSite=None with Secure, not Lax", () => {
    expect(resolveCookieAttributes(captured)).toEqual({
      secure: true,
      sameSite: "none",
      partitioned: true,
    });
  });

  it("stays on Lax when there is no evidence of an embedded context", () => {
    // Same proxy-reported http, but a plain top-level navigation: Lax is right
    // and Secure must not be forced on.
    const attrs = resolveCookieAttributes({
      ...captured,
      secFetchSite: "none",
      secFetchDest: "document",
    });
    expect(attrs).toEqual({ secure: false, sameSite: "lax", partitioned: false });
  });
});

/**
 * CHIPS / Partitioned coverage.
 *
 * The session cookie inside the hosted preview is a THIRD-PARTY cookie: the app
 * is framed by another origin. Once a browser blocks third-party cookies,
 * `SameSite=None; Secure` is not sufficient — the cookie is refused outright,
 * which presents as a login that succeeds and then bounces straight back to
 * /login. `Partitioned` scopes the cookie to the embedding top-level site,
 * which is the mechanism designed for exactly this.
 */
describe("partitioned (CHIPS) cookies for embedded contexts", () => {
  const embedded = {
    forwardedProto: "http",
    secFetchSite: "cross-site",
    secFetchDest: "iframe",
    secureOverride: null,
    sameSiteOverride: null,
    nodeEnv: "development",
  };

  it("is set whenever the cookie has to be SameSite=None", () => {
    expect(resolveCookieAttributes(embedded).partitioned).toBe(true);
  });

  it("is never set on a Lax cookie", () => {
    // Partitioned requires SameSite=None; a top-level Lax cookie must not carry
    // it or browsers reject the attribute combination.
    const attrs = resolveCookieAttributes({
      ...embedded,
      secFetchSite: "none",
      secFetchDest: "document",
    });
    expect(attrs).toEqual({ secure: false, sameSite: "lax", partitioned: false });
  });

  it("can be disabled explicitly", () => {
    const attrs = resolveCookieAttributes({ ...embedded, partitionedOverride: "false" });
    expect(attrs).toEqual({ secure: true, sameSite: "none", partitioned: false });
  });

  it("is not set when SameSite=None was downgraded to Lax", () => {
    const attrs = resolveCookieAttributes({
      ...embedded,
      sameSiteOverride: "none",
      secureOverride: "false",
    });
    expect(attrs.partitioned).toBe(false);
  });
});
