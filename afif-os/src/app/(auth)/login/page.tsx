import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/server/auth/session";
import { hasAnyAccount } from "@/server/services/account";

export const metadata: Metadata = { title: "Sign in — Afif OS" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; next?: string }>;
}) {
  const record = await getSessionUser();
  if (record) redirect("/dashboard");

  const params = await searchParams;
  const needsSetup = !(await hasAnyAccount());

  return <LoginForm reason={params.reason} next={params.next} needsSetup={needsSetup} />;
}
