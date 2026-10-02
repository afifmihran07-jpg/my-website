"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { MobileTabs } from "@/components/layout/MobileTabs";
import { CommandPalette } from "@/components/search/CommandPalette";
import { QuickAdd } from "@/components/quick-add/QuickAdd";
import { StudyProvider } from "@/components/study/StudyProvider";
import type { PublicUser } from "@/server/auth/session";

const TITLES: Array<{ match: (p: string) => boolean; title: string; subtitle: string }> = [
  { match: (p) => p === "/dashboard", title: "Dashboard", subtitle: "Where you are and what matters now" },
  { match: (p) => p.startsWith("/today"), title: "Today", subtitle: "Classes, tasks, deadlines and study" },
  { match: (p) => p.startsWith("/tasks"), title: "Tasks", subtitle: "Everything you need to do" },
  { match: (p) => p.startsWith("/calendar"), title: "Calendar", subtitle: "What happened and what is coming" },
  { match: (p) => p === "/study", title: "Study Timer", subtitle: "Self-study only — class time is separate" },
  { match: (p) => p.startsWith("/study/history"), title: "Study History", subtitle: "Daily record of your self-study" },
  { match: (p) => p.startsWith("/reminders"), title: "Reminders", subtitle: "Scheduled, sent, missed and retried" },
  { match: (p) => p.startsWith("/academic"), title: "Academic", subtitle: "Semesters, courses, marks and CGPA" },
  { match: (p) => p.startsWith("/learning"), title: "Learning", subtitle: "Books, notes, questions and skills" },
  { match: (p) => p.startsWith("/projects"), title: "Projects", subtitle: "Goals turned into work" },
  { match: (p) => p.startsWith("/opportunities"), title: "Opportunities", subtitle: "Competitions, scholarships and more" },
  { match: (p) => p.startsWith("/life"), title: "Life", subtitle: "Activities, prayer, medication, diary" },
  { match: (p) => p.startsWith("/analytics"), title: "Analytics", subtitle: "Evidence, not vanity metrics" },
  { match: (p) => p.startsWith("/advisor"), title: "AI Advisor", subtitle: "Advice with reasons" },
  { match: (p) => p.startsWith("/settings"), title: "Settings", subtitle: "Account, privacy and data" },
];

export function AppShell({
  user,
  unreadCount,
  children,
}: {
  user: PublicUser;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);

  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const heading = TITLES.find((entry) => entry.match(pathname)) ?? {
    title: "Afif OS",
    subtitle: "Personal operating system",
  };

  return (
    <StudyProvider>
    <div className="min-h-dvh">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} onOpenSearch={() => setSearchOpen(true)} />

      <div className="lg:pl-[268px]">
        <Topbar
          user={user}
          unreadCount={unreadCount}
          onOpenNav={() => setNavOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          title={heading.title}
          subtitle={heading.subtitle}
        />

        <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-5 lg:pb-10">{children}</main>
      </div>

      <MobileTabs onQuickAdd={() => setQuickAddOpen(true)} />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
    </StudyProvider>
  );
}
