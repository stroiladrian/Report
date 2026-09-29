import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { changePassword, authenticate } from "@/server/services/auth";
import { finishGoogleFlow, startGoogleFlow, upsertGoogleUser, type GoogleProfile } from "@/server/services/google";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (claims: object) => `${b64({ alg: "RS256" })}.${b64(claims)}.sig`;

describe("sign in with Google", () => {
  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("builds a PKCE authorization URL", () => {
    const { url, flow } = startGoogleFlow("http://localhost:3000/api/auth/google/callback", "/submit");
    const u = new URL(url);
    expect(u.host).toBe("accounts.google.com");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("state")).toBe(flow.state);
    expect(u.searchParams.get("nonce")).toBe(flow.nonce);
    expect(flow.returnTo).toBe("/submit");
  });

  it("validates the ID token claims", async () => {
    const flow = { state: "s", verifier: "v", nonce: "n1", returnTo: "/" };
    const good = { iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID, exp: Date.now() / 1000 + 300, nonce: "n1", sub: "123", email: "A@Gmail.com", email_verified: true, given_name: "Ana", family_name: "Pop" };
    const stub = (claims: object) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 })));

    stub(good);
    const p = await finishGoogleFlow("code", "http://x/cb", flow);
    expect(p).toMatchObject({ sub: "123", email: "a@gmail.com", emailVerified: true, givenName: "Ana" });

    for (const bad of [{ aud: "other" }, { iss: "https://evil" }, { nonce: "x" }, { exp: 1 }]) {
      stub({ ...good, ...bad });
      await expect(finishGoogleFlow("code", "http://x/cb", flow)).rejects.toMatchObject({ code: "GOOGLE_FAILED" });
    }
  });

  const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
    sub: `g-${Date.now()}-${Math.random()}`,
    email: `g-${Date.now()}-${Math.random().toString(36).slice(2)}@gmail.test`,
    emailVerified: true,
    givenName: "Ioana",
    familyName: "Ionescu",
    name: "Ioana Ionescu",
    locale: "ro",
    ...over,
  });

  it("creates a verified citizen on first sign-in, reuses it afterwards", async () => {
    const p = profile();
    const u = await upsertGoogleUser(p);
    expect(u.googleSub).toBe(p.sub);
    expect(u.emailVerifiedAt).not.toBeNull();
    expect(u.passwordHash).toBeNull();
    const role = await db.role.findUniqueOrThrow({ where: { id: u.roleId } });
    expect(role.key).toBe("CITIZEN");
    const again = await upsertGoogleUser({ ...p, email: "changed@gmail.test" });
    expect(again.id).toBe(u.id);

    // Google-only users can set a first password without a current one.
    await changePassword(u.id, "", "a-brand-new-password");
    expect((await authenticate(p.email!, "a-brand-new-password")).id).toBe(u.id);
  });

  it("links to an existing account with the same verified e-mail", async () => {
    const role = await db.role.findUniqueOrThrow({ where: { key: "CITIZEN" } });
    const p = profile();
    const existing = await db.user.create({ data: { email: p.email, firstName: "X", lastName: "Y", roleId: role.id } });
    const u = await upsertGoogleUser(p);
    expect(u.id).toBe(existing.id);
    expect(u.googleSub).toBe(p.sub);
    expect(u.emailVerifiedAt).not.toBeNull();
  });

  it("refuses unverified e-mails and disabled accounts", async () => {
    await expect(upsertGoogleUser(profile({ emailVerified: false }))).rejects.toMatchObject({ code: "GOOGLE_EMAIL_UNVERIFIED" });
    const p = profile();
    const u = await upsertGoogleUser(p);
    await db.user.update({ where: { id: u.id }, data: { isActive: false } });
    await expect(upsertGoogleUser(p)).rejects.toMatchObject({ code: "ACCOUNT_DISABLED" });
  });
});
