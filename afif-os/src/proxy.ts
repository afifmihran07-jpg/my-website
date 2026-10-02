import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast path only. This runs at the edge and cannot reach the database, so it
 * checks for the *presence* of a session cookie to avoid rendering the whole
 * app before bouncing an anonymous visitor.
 *
 * Actual authorization is always performed server-side by `requireUser()` in
 * the protected layout and by every server action / route handler.
 */
const SESSION_COOKIE = process.env.SESSION_COOKIE || "afif_os_session";

const PUBLIC_PATHS = ["/login", "/setup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isPublic) {
    // Signed-in users should not sit on the login screen.
    if (hasSession && (pathname === "/login" || pathname === "/setup")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("reason", "auth_required");
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // API routes are deliberately excluded: each handler performs its own
  // server-side authorization and returns a JSON 401 rather than an HTML
  // redirect, which is what a fetch() caller can actually handle.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
