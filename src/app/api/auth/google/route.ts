import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { googleEnabled, startGoogleFlow } from "@/server/services/google";
import { FLOW_COOKIE, encodeFlow, publicOrigin, redirectUri, safeReturn } from "./flow";

/** Step 1: redirect the browser to Google's consent screen. */
export async function GET(req: NextRequest) {
  const returnTo = safeReturn(req.nextUrl.searchParams.get("returnTo"));
  if (!googleEnabled()) return NextResponse.redirect(`${publicOrigin(req)}/login?error=google`);
  try {
    rateLimit("login", `google:${clientIp(req)}`);
  } catch {
    return NextResponse.redirect(`${publicOrigin(req)}/login?error=too_many`);
  }
  const { url, flow } = startGoogleFlow(redirectUri(req), returnTo);
  const res = NextResponse.redirect(url);
  res.cookies.set(FLOW_COOKIE, encodeFlow(flow), {
    httpOnly: true,
    sameSite: "lax", // must survive the top-level redirect back from Google
    secure: publicOrigin(req).startsWith("https://"),
    path: "/api/auth/google",
    maxAge: 600,
  });
  return res;
}
