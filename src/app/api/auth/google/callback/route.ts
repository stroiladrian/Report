import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { clientIp } from "@/lib/http";
import { createSession, requestMeta } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getLocale } from "@/lib/i18n/server";
import { finishGoogleFlow, googleEnabled, upsertGoogleUser } from "@/server/services/google";
import { FLOW_COOKIE, parseFlow, publicOrigin, redirectUri, safeReturn } from "../flow";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Step 2: Google redirects back here with ?code&state. */
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req);
  const flow = parseFlow(req.cookies.get(FLOW_COOKIE)?.value);
  const fail = (code: string) => {
    const r = NextResponse.redirect(`${origin}/login?error=${code}${flow?.returnTo && flow.returnTo !== "/" ? `&returnTo=${encodeURIComponent(flow.returnTo)}` : ""}`);
    r.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth/google" });
    return r;
  };

  const p = req.nextUrl.searchParams;
  if (!googleEnabled()) return fail("google");
  if (p.get("error")) return fail("google_cancelled"); // user pressed "Cancel" on Google
  const code = p.get("code");
  const state = p.get("state");
  if (!flow || !code || !state || !same(state, flow.state)) return fail("google");

  try {
    const profile = await finishGoogleFlow(code, redirectUri(req), flow);
    const user = await upsertGoogleUser(profile, { ip: clientIp(req), locale: await getLocale() });
    await createSession(user.id, await requestMeta());
    const r = NextResponse.redirect(`${origin}${safeReturn(flow.returnTo)}`);
    r.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth/google" });
    return r;
  } catch (e) {
    console.error("[google-login]", e);
    if (e instanceof AppError && e.code === "ACCOUNT_DISABLED") return fail("disabled");
    if (e instanceof AppError && e.code === "GOOGLE_EMAIL_UNVERIFIED") return fail("google_email");
    return fail("google");
  }
}
