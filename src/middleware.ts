import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER } from "@/lib/theme/shared";

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
  if (pathname.startsWith("/api/")) return NextResponse.next();
  // Pages: tell the root layout which path it renders (public site vs. back-office theme).
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // API calls (CSRF) and all pages; static assets are skipped.
  matcher: ["/api/:path*", "/((?!_next/|brand/|favicon|.*\\.(?:svg|png|jpg|jpeg|webp|ico|txt|xml)$).*)"],
};
