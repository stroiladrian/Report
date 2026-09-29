/**
 * "Sign in with Google" (OpenID Connect, authorization-code flow with PKCE).
 *
 * Configure GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env – when they are
 * empty the feature is switched off and the button is hidden.
 *
 * The ID token is received directly from Google's token endpoint over TLS
 * (server-to-server), so per OIDC Core §3.1.3.7 its signature does not need to
 * be re-verified; we still check issuer, audience, expiry and nonce.
 */
import { createHash } from "node:crypto";
import { appConfig } from "@config/app";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { randomToken } from "@/lib/auth/crypto";
import { isLocale, type Locale } from "@/lib/i18n/core";
import { ROLE_KEYS } from "@/lib/rbac/permissions";
import { audit } from "./audit";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export function googleEnabled() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Short-lived state kept in an httpOnly cookie between the redirect and the callback. */
export type GoogleFlowState = { state: string; verifier: string; nonce: string; returnTo: string };

export function startGoogleFlow(redirectUri: string, returnTo: string) {
  const flow: GoogleFlowState = { state: randomToken(24), verifier: randomToken(48), nonce: randomToken(24), returnTo };
  const challenge = createHash("sha256").update(flow.verifier).digest("base64url");
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), flow };
}

export type GoogleProfile = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  name: string | null;
  locale: string | null;
};

/** Exchange the authorization code and return the verified identity. */
export async function finishGoogleFlow(code: string, redirectUri: string, flow: GoogleFlowState): Promise<GoogleProfile> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new AppError(400, "GOOGLE_FAILED", `Google token exchange failed (${res.status}): ${await res.text()}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new AppError(400, "GOOGLE_FAILED", "Google did not return an ID token");

  const payload = id_token.split(".")[1];
  if (!payload) throw new AppError(400, "GOOGLE_FAILED", "Malformed ID token");
  const c = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  if (!ISSUERS.has(String(c.iss))) throw new AppError(400, "GOOGLE_FAILED", "Bad issuer");
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(process.env.GOOGLE_CLIENT_ID)) throw new AppError(400, "GOOGLE_FAILED", "Bad audience");
  if (typeof c.exp !== "number" || c.exp * 1000 < Date.now() - 60_000) throw new AppError(400, "GOOGLE_FAILED", "Token expired");
  if (c.nonce !== flow.nonce) throw new AppError(400, "GOOGLE_FAILED", "Nonce mismatch");
  if (typeof c.sub !== "string" || !c.sub) throw new AppError(400, "GOOGLE_FAILED", "Missing subject");

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    sub: c.sub,
    email: str(c.email)?.toLowerCase() ?? null,
    emailVerified: c.email_verified === true || c.email_verified === "true",
    givenName: str(c.given_name),
    familyName: str(c.family_name),
    name: str(c.name),
    locale: str(c.locale),
  };
}

/**
 * Find or create the local account for a Google identity:
 *  1. already linked (googleSub)            → sign in
 *  2. same verified e-mail as an account    → link it and sign in
 *  3. otherwise                             → create a CITIZEN account (e-mail already verified)
 */
export async function upsertGoogleUser(p: GoogleProfile, meta: { ip?: string | null; locale?: Locale } = {}) {
  let user = await db.user.findUnique({ where: { googleSub: p.sub } });

  if (!user) {
    if (!p.email || !p.emailVerified) {
      throw new AppError(400, "GOOGLE_EMAIL_UNVERIFIED", "The Google account has no verified e-mail address");
    }
    const existing = await db.user.findUnique({ where: { email: p.email } });
    if (existing) {
      user = await db.user.update({
        where: { id: existing.id },
        data: { googleSub: p.sub, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
      });
      await audit({ actorId: user.id, action: "user.google_linked", entityType: "user", entityId: user.id, ip: meta.ip });
    } else {
      const role = await db.role.findUnique({ where: { key: ROLE_KEYS.CITIZEN } });
      if (!role) throw new Error("CITIZEN role missing – run the seed");
      const [first, ...rest] = (p.name ?? p.email.split("@")[0]!).split(/\s+/);
      const googleLocale = p.locale?.slice(0, 2);
      user = await db.user.create({
        data: {
          email: p.email,
          googleSub: p.sub,
          firstName: (p.givenName ?? first ?? "").slice(0, 80) || "—",
          lastName: (p.familyName ?? rest.join(" ")).slice(0, 80) || "—",
          roleId: role.id,
          locale: meta.locale ?? (googleLocale && isLocale(googleLocale) ? googleLocale : appConfig.defaultLocale),
          emailVerifiedAt: new Date(),
          consentAt: new Date(),
        },
      });
      await audit({ actorId: user.id, action: "user.register_google", entityType: "user", entityId: user.id, ip: meta.ip });
    }
  }

  if (!user.isActive) throw new AppError(403, "ACCOUNT_DISABLED", "Account disabled");
  await audit({ actorId: user.id, action: "user.login_google", entityType: "user", entityId: user.id, ip: meta.ip });
  return user;
}
