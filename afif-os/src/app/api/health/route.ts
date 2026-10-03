import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

/** Liveness + database reachability, without leaking the connection string. */
export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, database: "missing DATABASE_URL" }, { status: 503 });
  }
  try {
    const client = postgres(url, { max: 1, connect_timeout: 5, idle_timeout: 5 });
    const rows = await client`select 1 as ok`;
    await client.end({ timeout: 2 });
    return NextResponse.json({ ok: true, database: rows[0]?.ok === 1 ? "connected" : "unexpected" });
  } catch {
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
