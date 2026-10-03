"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Timer, X } from "lucide-react";
import { NAV_GROUPS, NAV_STANDALONE } from "@/components/layout/nav";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/primitives";
import { StudyStatusPill } from "@/components/study/StudyStatusPill";

function isActive(pathname: string, href: string) {
  const base = href.split("?")[0] ?? "";
  if (base === "/dashboard") return pathname === base;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function Sidebar({
  open,
  onClose,
  onOpenSearch,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const groups = React.useMemo(
    () =>
      NAV_GROUPS.map((group) => {
        const expanded = group.items.some((item) => isActive(pathname, item.href)) || !collapsed[group.label];
        return { ...group, expanded };
      }),
    [pathname, collapsed],
  );

  return (
    <>
      {open ? (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-border bg-card transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
              A
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Afif<span className="text-muted-foreground"> OS</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2.5 py-3">
          <Link
            href="/dashboard"
            onClick={onClose}
            className={cn(
              "mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              isActive(pathname, "/dashboard") ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <LayoutIcon active={isActive(pathname, "/dashboard")} />
            Dashboard
          </Link>

          <button
            onClick={onOpenSearch}
            className="mb-3 flex w-full items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <span className="font-medium">Search…</span>
            <kbd className="ml-auto rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl K
            </kbd>
          </button>

          {NAV_STANDALONE.filter((item) => item.href !== "/dashboard").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                isActive(pathname, item.href)
                  ? "bg-primary/12 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}

          <div className="my-3 h-px bg-border" />

          {groups.map((group) => (
            <div key={group.label} className="mb-1">
              <button
                onClick={() => setCollapsed((prev) => ({ ...prev, [group.label]: !prev[group.label] }))}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:text-foreground"
                aria-expanded={group.expanded}
              >
                <group.icon className="h-3.5 w-3.5" />
                {group.label}
                <ChevronDown
                  className={cn("ml-auto h-3.5 w-3.5 transition-transform", !group.expanded && "-rotate-90")}
                />
              </button>
              {group.expanded ? (
                <div className="mt-0.5 space-y-0.5 border-l border-border pl-2 ml-3.5">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                        isActive(pathname, item.href)
                          ? "bg-primary/12 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.phase > 2 ? (
                        <Badge tone="neutral" className="ml-auto shrink-0 opacity-70">
                          P{item.phase}
                        </Badge>
                      ) : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <StudyStatusPill />
          <Link
            href="/study"
            onClick={onClose}
            className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Timer className="h-3.5 w-3.5" />
            Study Timer
          </Link>
        </div>
      </aside>
    </>
  );
}

function LayoutIcon({ active }: { active: boolean }) {
  const Icon = NAV_STANDALONE[0]!.icon;
  return <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />;
}
