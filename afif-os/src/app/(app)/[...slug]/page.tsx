import Link from "next/link";
import { ArrowRight, Hammer } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { NAV_GROUPS, NAV_STANDALONE, TOTAL_PHASES } from "@/components/layout/nav";

export const dynamic = "force-dynamic";

/**
 * Catch-all for URLs that match no real screen.
 *
 * Every module in the navigation is implemented, so reaching this page means the
 * address itself is wrong. It reports that plainly rather than pretending a
 * module is still under construction.
 */
export default async function ModulePlaceholder({ params }: { params: Promise<{ slug: string[] }> }) {
  await requireUser();
  const { slug } = await params;
  const path = `/${slug.join("/")}`;

  const item =
    [...NAV_STANDALONE, ...NAV_GROUPS.flatMap((group) => group.items)].find(
      (entry) => entry.href === path || entry.href.startsWith(`${path}?`) || path.startsWith(`${entry.href}/`),
    ) ?? null;

  const group = NAV_GROUPS.find((entry) => entry.items.some((child) => child.href === path || child.href.startsWith(`${path}?`)));

  const phase = item?.phase ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader
          title={item?.label ?? path}
          subtitle={group ? `${group.label} module` : "Module"}
          icon={<Hammer className="h-4 w-4" />}
          action={
            phase ? (
              <Badge tone="warning">Phase {phase} of {TOTAL_PHASES}</Badge>
            ) : (
              <Badge tone="danger">Not found</Badge>
            )
          }
        />
        <div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            {phase
              ? "This screen is not built yet. The tables it needs already exist in PostgreSQL and are migrated, so the schema is ready — only the interface is missing."
              : "No screen lives at this address. Every module in the navigation is built, so this is most likely a mistyped or outdated link."}
          </p>
          <p className="text-xs">
            Nothing on this page is placeholder data: Afif OS never renders invented records. When the module ships it
            will read and write the same tables the rest of the system already uses.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Build order</p>
            <ol className="mt-1.5 space-y-1 text-xs">
              {[
                "Authentication, database, layout, dashboard",
                "Tasks, calendar, study timer, study history",
                "Reminder engine, notifications",
                "Semesters, courses, assessments, CGPA",
                "Books, projects, achievements, opportunities",
                "Polymath, notes, questions, skills, knowledge graph",
                "Life modules: prayer, medication, diary, photos, timeline",
                "Analytics",
                "AI advisor",
              ].map((label, index) => {
                const done = index + 1 <= (phase ?? TOTAL_PHASES);
                return (
                  <li key={label} className="flex gap-2">
                    <span className={`tabular w-4 shrink-0 ${done ? "text-accent" : "text-muted-foreground/60"}`}>
                      {index + 1}.
                    </span>
                    <span className={done ? "text-foreground" : ""}>{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Working right now" subtitle="Jump to a module that is live" />
        <div className="grid gap-2 px-4 py-3 sm:grid-cols-2">
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/today", label: "Today" },
            { href: "/tasks", label: "Tasks" },
            { href: "/study", label: "Study timer" },
            { href: "/study/history", label: "Study history" },
            { href: "/calendar", label: "Calendar" },
            { href: "/reminders", label: "Reminders" },
            { href: "/academic", label: "Academic & CGPA" },
            { href: "/advisor", label: "AI advisor" },
            { href: "/settings", label: "Settings & export" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              {link.label}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </Card>

      <div className="flex justify-center">
        <Link href="/dashboard">
          <Button variant="secondary" size="sm">
            Back to dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
