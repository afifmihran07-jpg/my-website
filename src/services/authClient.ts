export interface SecurityCredentials {
  setupState: "INITIAL_SETUP_REQUIRED" | "INITIAL_SETUP_IN_PROGRESS" | "INITIAL_SETUP_COMPLETED";
  username: string;
  recoveryEmail: string;
  lockedUntil?: number;
}

type ApiError = { error?: string; message?: string; requiresSetup?: boolean; recoveryCode?: string };

async function request(action: string, init?: RequestInit) {
  const response = await fetch(`/api?action=${encodeURIComponent(action)}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const body = (await response.json().catch(() => ({}))) as ApiError;
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

let state: SecurityCredentials = {
  setupState: "INITIAL_SETUP_REQUIRED",
  username: "",
  recoveryEmail: "",
};

export class SecurityService {
  static async initialize() {
    const status = await request("setup-status");
    state = { ...state, setupState: (status as { state: SecurityCredentials["setupState"] }).state };
    return state;
  }

  static getStoredCredentials() {
    return state;
  }

  static async verifySession() {
    try {
      const session = (await request("admin-session")) as { username?: string };
      state.username = session.username ?? "";
      return true;
    } catch {
      return false;
    }
  }

  static async login(username: string, password: string) {
    const endpoint = state.setupState === "INITIAL_SETUP_COMPLETED" ? "login" : "bootstrap-login";
    try {
      const result = await request(endpoint, { method: "POST", body: JSON.stringify({ username, password }) });
      return { success: true, requireSetup: Boolean(result.requiresSetup) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Invalid credentials" };
    }
  }

  static async completeFirstTimeSetup(input: {
    newUsername: string;
    newPassword: string;
    confirmPassword: string;
    recoveryEmail: string;
    confirmRecoveryEmail: string;
  }) {
    if (input.newPassword !== input.confirmPassword) return { success: false, error: "Passwords do not match" };
    if (input.recoveryEmail !== input.confirmRecoveryEmail) return { success: false, error: "Recovery emails do not match" };
    try {
      const result = await request("setup-complete", {
        method: "POST",
        body: JSON.stringify({ username: input.newUsername, password: input.newPassword, recoveryEmail: input.recoveryEmail }),
      });
      state = { setupState: "INITIAL_SETUP_COMPLETED", username: input.newUsername, recoveryEmail: input.recoveryEmail };
      return { success: true, recoveryCode: result.recoveryCode };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Setup failed" };
    }
  }

  static async initiatePasswordReset(email: string) {
    const result = await request("forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    return { success: true, message: result.message ?? "If registered, reset instructions were sent." };
  }

  static async completePasswordReset(token: string, password: string) {
    try {
      await request("reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Reset failed" };
    }
  }

  static async recoverWithEmergencyCode(code: string, password: string) {
    try {
      await request("emergency-recovery", { method: "POST", body: JSON.stringify({ code, password }) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Recovery failed" };
    }
  }

  static async changeUsername(currentPassword: string, username: string) {
    return this.change({ currentPassword, username });
  }

  static async changePassword(currentPassword: string, password: string) {
    return this.change({ currentPassword, password });
  }

  static async changeRecoveryEmail(currentPassword: string, recoveryEmail: string) {
    return this.change({ currentPassword, recoveryEmail });
  }

  private static async change(input: Record<string, string>) {
    try {
      await request("admin-security-change", { method: "POST", body: JSON.stringify(input) });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Security update failed" };
    }
  }

  static async generateNewEmergencyCode(currentPassword: string) {
    try {
      const result = await request("admin-recovery-code", { method: "POST", body: JSON.stringify({ currentPassword }) });
      return { success: true, code: result.recoveryCode };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Recovery code generation failed" };
    }
  }

  static async logout() {
    await request("logout", { method: "POST", body: "{}" }).catch(() => undefined);
    state.username = "";
  }
}