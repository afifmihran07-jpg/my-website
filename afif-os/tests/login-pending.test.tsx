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

const replace = vi.fn();
const refresh = vi.fn();
const loginAction = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/server/auth/actions", () => ({
  loginAction: (...args: unknown[]) => loginAction(...args),
}));

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
    replace.mockReset();
    refresh.mockReset();
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
      expect(replace).toHaveBeenCalledWith("/dashboard");
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("prefers a safe `next` path and ignores one that leaves the site", async () => {
    loginAction.mockResolvedValue({ ok: true, data: { redirectTo: "/dashboard" } });
    const { container } = render(<LoginForm needsSetup={false} next="https://evil.example/" />);

    submitForm(container);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dashboard");
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
