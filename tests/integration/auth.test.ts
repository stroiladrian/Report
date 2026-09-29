import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  authenticate,
  changePassword,
  registerCitizen,
  requestPasswordReset,
  requestPhoneOtp,
  resetPassword,
  verifyEmail,
  verifyPhoneOtp,
} from "@/server/services/auth";

const lastMessage = async (to: string) =>
  db.notificationDelivery.findFirstOrThrow({ where: { recipient: to }, orderBy: { createdAt: "desc" } });

const tokenFrom = (body: string) => /token=([\w-]+)/.exec(body)![1]!;

describe("authentication", () => {
  const email = `reg-${Date.now()}@test.local`;

  it("registers a citizen, hashes the password and sends a verification e-mail (mock)", async () => {
    const u = await registerCitizen({ firstName: "Ana", lastName: "Pop", email, phone: null, password: "a-good-password", gdpr: true, truthful: true });
    expect(u.passwordHash).toMatch(/^scrypt\$/);
    expect(u.emailVerifiedAt).toBeNull();
    const msg = await lastMessage(email);
    expect(msg.channel).toBe("EMAIL");
    expect(msg.status).toBe("MOCKED");
    expect(msg.body).toContain("/verify-email?token=");
    expect(await db.auditLog.count({ where: { action: "user.register", entityId: u.id } })).toBe(1);
  });

  it("rejects duplicate e-mails", async () => {
    await expect(
      registerCitizen({ firstName: "A", lastName: "B", email, phone: null, password: "a-good-password", gdpr: true, truthful: true }),
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
  });

  it("verifies the e-mail with the one-time link", async () => {
    const token = tokenFrom((await lastMessage(email)).body);
    expect(await verifyEmail(token)).toBeTruthy();
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();
    expect(await verifyEmail(token)).toBeNull(); // single use
  });

  it("authenticates with correct credentials only", async () => {
    await expect(authenticate(email, "wrong-password")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(authenticate("nobody@test.local", "whatever")).rejects.toBeInstanceOf(AppError);
    expect((await authenticate(email, "a-good-password")).email).toBe(email);
  });

  it("resets the password through the e-mailed link and revokes sessions", async () => {
    const u = await db.user.findUniqueOrThrow({ where: { email } });
    await db.session.create({ data: { id: `s-${Date.now()}`, userId: u.id, expiresAt: new Date(Date.now() + 1e6) } });
    await requestPasswordReset(email);
    const token = tokenFrom((await lastMessage(email)).body);
    await resetPassword(token, "brand-new-password");
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    await expect(resetPassword(token, "another-password")).rejects.toMatchObject({ code: "INVALID_CODE" });
    await authenticate(email, "brand-new-password");
    await changePassword(u.id, "brand-new-password", "third-password!");
    await expect(changePassword(u.id, "wrong", "x-password-long")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("logs in with an SMS one-time code (mock SMS)", async () => {
    const phone = `+407${String(Date.now()).slice(-8)}`;
    await db.user.update({ where: { email }, data: { phone } });
    await requestPhoneOtp(phone, "ro");
    const sms = await lastMessage(phone);
    expect(sms.channel).toBe("SMS");
    const code = /(\d{6})/.exec(sms.body)![1]!;
    await expect(verifyPhoneOtp(phone, code === "000000" ? "111111" : "000000")).rejects.toMatchObject({ code: "INVALID_CODE" });
    const user = await verifyPhoneOtp(phone, code);
    expect(user.phoneVerifiedAt).not.toBeNull();
    await expect(verifyPhoneOtp(phone, code)).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("does not reveal unknown phone numbers", async () => {
    await expect(requestPhoneOtp("+40799999999", "ro")).resolves.toBeUndefined();
  });
});
