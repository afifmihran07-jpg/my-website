import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { hasAnyAccount } from "@/server/services/account";

export const dynamic = "force-dynamic";

/** Root is a router, not a page: signed in → dashboard, first run → setup. */
export default async function RootPage() {
  const record = await getSessionUser();
  if (record) redirect("/dashboard");
  if (!(await hasAnyAccount())) redirect("/setup");
  redirect("/login");
}
