import { AppShell } from "@/components/layout/AppShell";
import { publicUser, requireUser } from "@/server/auth/session";
import { unreadNotificationCount } from "@/server/services/reminders";

export const dynamic = "force-dynamic";

/**
 * Every page inside this group is protected. `requireUser()` verifies the
 * session against the database on every request — the edge proxy only decides
 * whether to bother rendering at all.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await unreadNotificationCount(user.id);

  return (
    <AppShell user={publicUser(user)} unreadCount={unread}>
      {children}
    </AppShell>
  );
}
