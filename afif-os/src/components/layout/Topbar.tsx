"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Moon, Search, Settings, ShieldCheck, Sun } from "lucide-react";
import { logoutAction } from "@/server/auth/actions";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { PublicUser } from "@/server/auth/session";
import { Badge } from "@/components/ui/primitives";

export function Topbar({
  user,
  unreadCount,
  onOpenNav,
  onOpenSearch,
  title,
  subtitle,
}: {
  user: PublicUser;
  unreadCount: number;
  onOpenNav: () => void;
  onOpenSearch: () => void;
  title: string;
  subtitle?: string;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<"light" | "dark" | null>(null);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const stored = localStorage.getItem("afif-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("afif-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    const result = await logoutAction();
    if (result.ok) router.replace(result.data.redirectTo);
    else setLoggingOut(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center gap-1.5 px-3 sm:px-5">
        <button
          onClick={onOpenNav}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</h1>
          {subtitle ? <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p> : null}
        </div>

        <button
          onClick={onOpenSearch}
          className="hidden items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          Search
          <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
        <button
          onClick={onOpenSearch}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Toggle colour theme"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        <Link
          href="/reminders"
          className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Link>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-muted"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
              {initials(user.fullName)}
            </span>
            <span className="hidden text-xs font-medium sm:block">{user.fullName.split(" ")[0]}</span>
          </button>

          {menuOpen ? (
            <>
              <button
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                role="menu"
                className="animate-fade-up absolute right-0 z-20 mt-2 w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl"
              >
                <div className="border-b border-border px-2.5 pb-2.5 pt-1.5">
                  <p className="truncate text-sm font-medium">{user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" /> Settings
                </Link>
                <Link
                  href="/settings?tab=privacy"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  role="menuitem"
                >
                  <ShieldCheck className="h-4 w-4" /> Privacy &amp; AI access
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger hover:bg-danger/10",
                    loggingOut && "opacity-60",
                  )}
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" /> {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {unreadCount > 0 ? (
        <Link
          href="/reminders"
          className="flex items-center gap-2 border-t border-border bg-warning/10 px-4 py-1.5 text-xs text-warning"
        >
          <Bell className="h-3.5 w-3.5" />
          <span>
            {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
          </span>
          <Badge tone="warning" className="ml-auto">
            Review
          </Badge>
        </Link>
      ) : null}
    </header>
  );
}
