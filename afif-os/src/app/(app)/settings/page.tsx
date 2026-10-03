import { eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { db } from "@/server/db";
import { aiPermissions } from "@/server/db/schema";
import { csvTableNames } from "@/server/services/export";

export const dynamic = "force-dynamic";

const DEFAULT_PERMISSIONS = {
  academic: true,
  grades: true,
  study: true,
  books: true,
  tasks: true,
  projects: true,
  calendar: true,
  polymath: true,
  skills: true,
  questions: true,
  opportunities: true,
  achievements: true,
  diary: false,
  photos: false,
  medication: false,
  prayer: false,
};

export default async function SettingsPage() {
  const user = await requireUser();
  const [row] = await db.select().from(aiPermissions).where(eq(aiPermissions.userId, user.id)).limit(1);

  const permissions = { ...DEFAULT_PERMISSIONS };
  if (row) {
    for (const key of Object.keys(DEFAULT_PERMISSIONS) as Array<keyof typeof DEFAULT_PERMISSIONS>) {
      permissions[key] = row[key];
    }
  }

  return (
    <SettingsClient
      user={{
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        timezone: user.timezone,
        theme: user.theme,
        weekStartsOn: user.weekStartsOn,
      }}
      permissions={permissions}
      csvTables={[...csvTableNames()]}
    />
  );
}
