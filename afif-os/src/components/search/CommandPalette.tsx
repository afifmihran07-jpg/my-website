"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import { searchAction } from "@/server/services/search-actions";
import type { SearchHit } from "@/server/services/search";
import { cn } from "@/lib/cn";

const TYPE_TONE: Record<SearchHit["type"], string> = {
  course: "text-primary",
  semester: "text-primary",
  task: "text-accent",
  project: "text-warning",
  book: "text-primary",
  note: "text-muted-foreground",
  concept: "text-accent",
  question: "text-warning",
  skill: "text-accent",
  opportunity: "text-warning",
  achievement: "text-primary",
  study_session: "text-muted-foreground",
  event: "text-muted-foreground",
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const result = await searchAction(term);
      if (cancelled) return;
      setHits(result.ok ? result.data : []);
      setCursor(0);
      setLoading(false);
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  const go = (hit: SearchHit) => {
    onClose();
    router.push(hit.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter" && hits[cursor]) {
      event.preventDefault();
      go(hits[cursor]!);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" aria-label="Close search" onClick={onClose} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="animate-fade-up relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses, tasks, books, notes, projects…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            aria-label="Search query"
          />
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div className="scrollbar-thin max-h-[52vh] overflow-y-auto p-1.5">
          {query.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Type at least two characters to search everything at once.
            </p>
          ) : hits.length === 0 && !loading ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Nothing matched “{query.trim()}”.
            </p>
          ) : (
            hits.map((hit, index) => (
              <button
                key={`${hit.type}-${hit.id}`}
                onMouseEnter={() => setCursor(index)}
                onClick={() => go(hit)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                  index === cursor ? "bg-primary/12" : "hover:bg-muted",
                )}
              >
                <span className={cn("w-20 shrink-0 text-[10px] font-semibold uppercase tracking-wide", TYPE_TONE[hit.type])}>
                  {hit.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{hit.title}</span>
                  {hit.subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{hit.subtitle}</span> : null}
                </span>
                {index === cursor ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
