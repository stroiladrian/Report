import type { NextRequest } from "next/server";
import type { GoogleFlowState } from "@/server/services/google";

export const FLOW_COOKIE = "cr_google_flow";

/** Public origin of this request (works behind proxies / tunnels / LAN IPs). */
export function publicOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? req.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const redirectUri = (req: NextRequest) => `${publicOrigin(req)}/api/auth/google/callback`;

export function safeReturn(to: string | null | undefined) {
  return to && to.startsWith("/") && !to.startsWith("//") && !to.startsWith("/\\") ? to : "/";
}

export function parseFlow(raw: string | undefined): GoogleFlowState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as GoogleFlowState;
    return v && typeof v.state === "string" && typeof v.verifier === "string" && typeof v.nonce === "string" ? v : null;
  } catch {
    return null;
  }
}

export const encodeFlow = (f: GoogleFlowState) => Buffer.from(JSON.stringify(f)).toString("base64url");
