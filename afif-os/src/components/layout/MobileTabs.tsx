"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, LayoutDashboard, ListTodo, Plus, Sunrise } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/today", label: "Today", icon: Sunrise },
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/study/history", label: "Study", icon: History },
];

/**
 * One or two taps to the actions that matter on a phone (§36).
 * Deliberately fixed to the bottom of the viewport with large hit areas.
 */
export function MobileTabs({ onQuickAdd }: { onQuickAdd: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 items-center">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
        ))}

        <button
          onClick={onQuickAdd}
          className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-primary"
          aria-label="Quick add"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Plus className="h-5 w-5" />
          </span>
          Add
        </button>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({ tab, active }: { tab: (typeof TABS)[number]; active: boolean }) {
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <tab.icon className="h-5 w-5" />
      {tab.label}
    </Link>
  );
}
