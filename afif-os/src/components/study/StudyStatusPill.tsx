"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useStudy } from "@/components/study/StudyProvider";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Compact live indicator pinned to the sidebar so the timer is never lost. */
export function StudyStatusPill() {
  const { dto, elapsed, loading } = useStudy();

  if (loading) {
    return <div className="h-9 animate-pulse rounded-lg bg-muted" />;
  }

  if (!dto) {
    return (
      <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
        No session running. Self-study is tracked separately from university class time.
      </p>
    );
  }

  const paused = dto.status === "paused";

  return (
    <Link
      href="/study"
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
        paused ? "border-warning/40 bg-warning/10" : "border-accent/40 bg-accent/10",
      )}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-full",
          paused ? "bg-warning/20 text-warning" : "timer-live bg-accent/20 text-accent",
        )}
      >
        {paused ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium">{dto.title}</span>
        <span className="tabular block text-[11px] text-muted-foreground">
          {paused ? "paused · " : ""}
          {formatDuration(elapsed)}
        </span>
      </span>
    </Link>
  );
}
