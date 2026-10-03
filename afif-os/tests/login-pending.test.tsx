// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Regression tests for the login form hanging on "Signing in…".
 *
 * The original handler awaited `loginAction` with no catch. When the action
 * rejected — a stale build answering "Server action not found", a dropped
 * connection, an unhandled server error — the promise threw past the handler,
 * `setPending(false)` was never reached, and the submit button stayed disabled
 * and labelled "Signing in…" forever with no way to retry.
 */

const assign = vi.fn();
const loginAction = vi.fn();
// The form verifies the session cookie round-trips before navigating, by
// fetching an authenticated endpoint. jsdom has no network, so stand in for it.
const probe = vi.fn();

vi.mock("@/server/auth/actions", () => ({
  loginAction: (...args: unknown[]) => loginAction(...args),
}));

// The form navigates with window.location.assign so the document unloads.
// jsdom does not implement navigation, so stand in for it.
beforeEach(() => {
  // Default: the browser kept the cookie, so the probe succeeds.
  probe.mockReset();
  probe.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", probe);

  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...window.location, assign, href: "http://localhost/login" },
  });
});

// Imported after the mocks are registered.
const { LoginForm } = await import("@/components/auth/LoginForm");

// `Field` renders its <label> without htmlFor, so the accessible-name queries
// cannot pair label and control. Query the controls directly instead.
function submitForm(container: HTMLElement) {
  const identifier = container.querySelector<HTMLInputElement>('input[name="identifier"]')!;
  const password = container.querySelector<HTMLInputElement>('input[name="password"]')!;
  fireEvent.change(identifier, { target: { value: "afif" } });
  fireEvent.change(password, { target: { value: "AfifOs!2026" } });
  fireEvent.submit(container.querySelector("form")!);
}

function submitButton(container: HTMLElement) {
  return container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
}

describe("LoginForm never stays pending after a submit settles", () => {
  beforeEach(() => {
    loginAction.mockReset();
    assign.mockReset();
  });

  afterEach(cleanup);

  it("clears the pending state when the action rejects (stale build / network failure)", async () => {
    loginAction.mockRejectedValue(new Error("Server action not found."));
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    // While in flight the button shows the pending label.
    expect(submitButton(container)).toHaveProperty("disabled", true);

    await waitFor(() => {
      expect(submitButton(container).textContent).toMatch(/sign in/i);
      expect(submitButton(container).textContent).not.toMatch(/signing in/i);
    });

    // The user is told what happened and can try again.
    expect(screen.getByText(/did not complete/i)).toBeTruthy();
    expect(submitButton(container)).toHaveProperty("disabled", false);
  });

  it("clears the pending state when the action returns a validation failure", async () => {
    loginAction.mockResolvedValue({ ok: false, error: "Incorrect username or password" });
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    await waitFor(() => {
      expect(screen.getByText("Incorrect username or password")).toBeTruthy();
    });
    expect(submitButton(container).textContent).not.toMatch(/signing in/i);
    expect(submitButton(container)).toHaveProperty("disabled", false);
  });

  it("navigates on success instead of leaving the form waiting", async () => {
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("navigates with a full document load, not a client-side route change", async () => {
    // A client-side navigation leaves this form mounted until the router
    // commits the new tree, so an unresolved navigation strands it on
    // "Signing in…". window.location.assign unloads the document instead,
    // which is why the post-login hop uses it.
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    await waitFor(() => {
      expect(assign).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("prefers a safe `next` path and ignores one that leaves the site", async () => {
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    const { container } = render(<LoginForm needsSetup={false} next="https://evil.example/" />);

    submitForm(container);

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("sends the typed credentials and the remember-me choice to the action", async () => {
    loginAction.mockResolvedValue({ ok: false, error: "nope" });
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    await waitFor(() => expect(loginAction).toHaveBeenCalled());
    expect(loginAction.mock.calls[0]![0]).toMatchObject({
      identifier: "afif",
      password: "AfifOs!2026",
      remember: true,
    });
  });
});

/**
 * A browser that blocks third-party cookies accepts the Set-Cookie and stores
 * nothing. Without a check, the form navigates to /dashboard, which has no
 * session and redirects straight back here — an endless loop with no
 * explanation. These cover the detection and the way out.
 */
describe("LoginForm when the browser refuses to keep the session cookie", () => {
  beforeEach(() => {
    loginAction.mockReset();
    assign.mockReset();
    probe.mockReset();
    vi.stubGlobal("fetch", probe);
  });

  afterEach(cleanup);

  it("does not navigate into the redirect loop", async () => {
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    probe.mockResolvedValue({ ok: false, status: 401 });
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    await waitFor(() => {
      expect(screen.getByText(/browser blocked the session cookie/i)).toBeTruthy();
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("says the password was correct, so the user does not retry forever", async () => {
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    probe.mockResolvedValue({ ok: false, status: 401 });
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    await waitFor(() => {
      expect(screen.getByText(/the password was correct/i)).toBeTruthy();
    });
    // And the button is usable again rather than stuck on "Signing in…".
    expect(submitButton(container)).toHaveProperty("disabled", false);
  });

  it("offers a way out that makes the cookie first-party", async () => {
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    probe.mockResolvedValue({ ok: false, status: 401 });
    const open = vi.fn();
    vi.stubGlobal("open", open);
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    const button = await screen.findByRole("button", { name: /open in a new tab/i });
    fireEvent.click(button);
    expect(open).toHaveBeenCalled();
  });

  it("treats a failed probe request as a blocked cookie, not a crash", async () => {
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    probe.mockRejectedValue(new TypeError("Failed to fetch"));
    const { container } = render(<LoginForm needsSetup={false} />);

    submitForm(container);

    await waitFor(() => {
      expect(screen.getByText(/browser blocked the session cookie/i)).toBeTruthy();
    });
    expect(assign).not.toHaveBeenCalled();
  });
});
