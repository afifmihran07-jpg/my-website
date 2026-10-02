"use client";

import * as React from "react";
import type { StudyDto } from "@/server/services/study";

/**
 * Single polling source for the running session, shared by the sidebar pill,
 * the dashboard card and the timer page so they never disagree.
 *
 * The server is the source of truth: we poll it, and derive the ticking clock
 * from `serverNow` rather than the device clock, so the timer stays correct
 * after a refresh, a sleep/wake cycle or a clock change.
 */

const POLL_MS = 20_000;
const HEARTBEAT_MS = 60_000;

type StudyState = {
  dto: StudyDto | null;
  loading: boolean;
  error: string | null;
  /** seconds elapsed, including the in-flight interval */
  elapsed: number;
  refresh: () => Promise<void>;
  setDto: (dto: StudyDto | null) => void;
};

const StudyContext = React.createContext<StudyState | null>(null);

export function StudyProvider({ children }: { children: React.ReactNode }) {
  const [dto, setDto] = React.useState<StudyDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(async () => {
    try {
      const response = await fetch("/api/study/active", { cache: "no-store" });
      if (response.status === 401) {
        setDto(null);
        setError(null);
        return;
      }
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const payload = (await response.json()) as { session: StudyDto | null };
      setDto(payload.session);
      setError(null);
    } catch {
      setError("Could not reach the server. Your session is safe — retrying.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Heartbeat only while something is genuinely running.
  React.useEffect(() => {
    if (dto?.status !== "active") return;
    const id = window.setInterval(() => {
      void fetch("/api/study/heartbeat", { method: "POST", cache: "no-store" }).catch(() => undefined);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [dto?.status]);

  React.useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = React.useMemo(() => {
    void tick;
    if (!dto) return 0;
    const serverNow = Date.parse(dto.serverNow);
    let base = dto.accumulatedSeconds;
    if (dto.status === "active" && dto.runningSince) {
      const running = (serverNow - Date.parse(dto.runningSince)) / 1000;
      base += Math.max(0, running);
    }
    return Math.max(0, Math.floor(base));
  }, [dto, tick]);

  const value = React.useMemo<StudyState>(
    () => ({ dto, loading, error, elapsed, refresh, setDto }),
    [dto, loading, error, elapsed, refresh],
  );

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyState {
  const context = React.useContext(StudyContext);
  if (!context) throw new Error("useStudy must be used inside <StudyProvider>");
  return context;
}
