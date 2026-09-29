import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware:
 *  - CSRF protection for state-changing API calls: the Origin (or Referer) must
 *    match the host. Combined with SameSite=Lax session cookies this blocks
 *    cross-site form/fetch submissions.
 *  - Cheap redirect of anonymous visitors away from /account and /admin
 *    (real authorization is enforced again on the server for every request).
 */
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_COOKIES = ["cr_session", "__Host-cr_session"];

function allowedOrigins(req: NextRequest) {
  const set = new Set<string>();
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  if (host) set.add(`${proto}://${host}`);
  if (process.env.APP_URL) set.add(new URL(process.env.APP_URL).origin);
  set.add(req.nextUrl.origin);
  return set;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE.has(req.method)) {
    const origin = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
    if (!origin || !allowedOrigins(req).has(origin)) {
      return NextResponse.json({ error: { code: "CSRF", message: "Cross-site request blocked" } }, { status: 403 });
    }
  }

  if (pathname.startsWith("/account") || pathname.startsWith("/admin")) {
    const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?returnTo=${encodeURIComponent(pathname + req.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/account/:path*", "/admin/:path*"],
};
