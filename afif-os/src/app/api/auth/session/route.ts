import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { env } from "@/server/env";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/**
 * Reports how far an authentication round-trip actually got.
 *
 * The distinction that matters is between "the browser sent no cookie" and
 * "the browser sent a cookie the server could not resolve". Those look
 * identical to a client that can only see a 401, but they have completely
 * different causes: the first is a browser refusing to store or send the
 * cookie, the second is a server-side session problem. Reporting them
 * separately is what makes the difference diagnosable.
 *
 * Deliberately reveals nothing sensitive: cookie NAMES only, never values, and
 * never whether a specific credential was valid.
 */
export async function GET() {
  const jar = await cookies();
  const name = env().SESSION_COOKIE;

  const all = (await jar.getAll()).map((c) => c.name);
  const presented = all.includes(name);

  let authenticated = false;
  let sessionResolved = false;
  try {
    const record = await getSessionUser();
    sessionResolved = Boolean(record);
    authenticated = Boolean(record);
  } catch {
    sessionResolved = false;
  }

  const h = await headers();

  return NextResponse.json({
    // Did any session cookie arrive on this request at all?
    cookiePresented: presented,
    cookieNames: all,
    // Did the presented cookie resolve to a live session?
    sessionResolved,
    authenticated,
    // Context the server actually saw, for correlating with the browser side.
    serverView: {
      forwardedProto: h.get("x-forwarded-proto"),
      host: h.get("host"),
      forwardedHost: h.get("x-forwarded-host"),
      origin: h.get("origin"),
      secFetchSite: h.get("sec-fetch-site"),
      secFetchDest: h.get("sec-fetch-dest"),
    },
  });
}
