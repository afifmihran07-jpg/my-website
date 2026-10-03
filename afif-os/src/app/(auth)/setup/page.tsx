import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth/SetupForm";
import { env } from "@/server/env";
import { getSessionUser } from "@/server/auth/session";
import { hasAnyAccount } from "@/server/services/account";

export const metadata: Metadata = { title: "Create your account — Afif OS" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const record = await getSessionUser();
  if (record) redirect("/dashboard");
  if (await hasAnyAccount()) redirect("/login?reason=setup_disabled");
  if (!env().ALLOW_FIRST_USER_SETUP) redirect("/login?reason=setup_disabled");

  return <SetupForm />;
}
