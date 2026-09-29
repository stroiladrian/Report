/**
 * Authentication use-cases. Cookie handling lives in lib/auth/session.ts;
 * this module only deals with users, credentials and one-time tokens so it can
 * be integration-tested without a Next.js request context.
 */
import { appConfig } from "@config/app";
import { db } from "@/lib/db";
import { AppError, Errors } from "@/lib/errors";
import { isLocale, type Locale } from "@/lib/i18n/core";
import { dummyVerify, hashPassword, numericCode, randomToken, sha256, verifyPassword } from "@/lib/auth/crypto";
import { ROLE_KEYS } from "@/lib/rbac/permissions";
import type { RegisterInput } from "@/lib/validation/schemas";
import { appUrl, sendAuthEmail, sendOtpSms } from "./notifications";
import { audit } from "./audit";

const A = appConfig.auth;

export async function registerCitizen(input: RegisterInput, meta: { ip?: string | null } = {}) {
  const role = await db.role.findUnique({ where: { key: ROLE_KEYS.CITIZEN } });
  if (!role) throw new Error("CITIZEN role missing – run the seed");
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw new AppError(409, "EMAIL_TAKEN", "An account with this e-mail already exists");
  }
  if (input.phone && (await db.user.findUnique({ where: { phone: input.phone } }))) {
    throw new AppError(409, "PHONE_TAKEN", "An account with this phone already exists");
  }
  const user = await db.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await hashPassword(input.password),
      roleId: role.id,
      locale: input.locale ?? appConfig.defaultLocale,
      consentAt: new Date(),
    },
  });
  await audit({ actorId: user.id, action: "user.register", entityType: "user", entityId: user.id, ip: meta.ip });
  await sendEmailVerification(user.id);
  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await dummyVerify(password);
    throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect e-mail or password");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AppError(401, "INVALID_CREDENTIALS", "Incorrect e-mail or password");
  if (!user.isActive) throw new AppError(403, "ACCOUNT_DISABLED", "Account disabled");
  return user;
}

async function issueToken(type: "EMAIL_VERIFY" | "PASSWORD_RESET" | "PHONE_OTP", target: string, userId: string | null, ttlMs: number, raw: string) {
  // Invalidate previous unconsumed tokens of the same kind for this target.
  await db.verificationToken.updateMany({
    where: { type, target, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await db.verificationToken.create({
    data: { type, target, userId, tokenHash: sha256(`${type}:${raw}`), expiresAt: new Date(Date.now() + ttlMs) },
  });
}

export async function sendEmailVerification(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.email || user.emailVerifiedAt) return;
  const raw = randomToken();
  await issueToken("EMAIL_VERIFY", user.email, user.id, A.verifyTokenTtlHours * 3_600_000, raw);
  await sendAuthEmail("email_verify", { email: user.email, name: user.firstName, locale: user.locale }, appUrl(`/verify-email?token=${raw}`));
}

export async function verifyEmail(raw: string) {
  const tok = await db.verificationToken.findUnique({ where: { tokenHash: sha256(`EMAIL_VERIFY:${raw}`) } });
  if (!tok || tok.consumedAt || tok.expiresAt < new Date() || !tok.userId) return null;
  await db.$transaction([
    db.verificationToken.update({ where: { id: tok.id }, data: { consumedAt: new Date() } }),
    db.user.update({ where: { id: tok.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
  await audit({ actorId: tok.userId, action: "user.email_verified", entityType: "user", entityId: tok.userId });
  return tok.userId;
}

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists (no user enumeration).
  if (!user || !user.isActive || !user.email) return;
  const raw = randomToken();
  await issueToken("PASSWORD_RESET", user.email, user.id, A.resetTokenTtlMinutes * 60_000, raw);
  await sendAuthEmail("password_reset", { email: user.email, name: user.firstName, locale: user.locale }, appUrl(`/reset-password?token=${raw}`));
}

export async function resetPassword(raw: string, password: string) {
  const tok = await db.verificationToken.findUnique({ where: { tokenHash: sha256(`PASSWORD_RESET:${raw}`) } });
  if (!tok || tok.consumedAt || tok.expiresAt < new Date() || !tok.userId) {
    throw new AppError(400, "INVALID_CODE", "Invalid or expired link");
  }
  await db.$transaction([
    db.verificationToken.update({ where: { id: tok.id }, data: { consumedAt: new Date() } }),
    // A reset link proves control of the mailbox → also verifies the e-mail.
    db.user.update({ where: { id: tok.userId }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: tok.userId } }),
  ]);
  await audit({ actorId: tok.userId, action: "user.password_reset", entityType: "user", entityId: tok.userId });
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound();
  // Accounts created with "Sign in with Google" may set a first password without a current one.
  if (user.passwordHash && !(await verifyPassword(current, user.passwordHash))) {
    throw new AppError(400, "INVALID_CREDENTIALS", "Current password is incorrect");
  }
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await audit({ actorId: userId, action: "user.password_change", entityType: "user", entityId: userId });
}

/** Phone login step 1 – send a one-time code (only to existing, active accounts). */
export async function requestPhoneOtp(phone: string, locale: Locale) {
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || !user.isActive) return; // silent – no enumeration
  const code = numericCode(A.otpLength);
  await issueToken("PHONE_OTP", phone, user.id, A.otpTtlMinutes * 60_000, code);
  await sendOtpSms(phone, code, isLocale(user.locale) ? user.locale : locale);
}

/** Phone login step 2 – verify the code; marks the phone as verified. */
export async function verifyPhoneOtp(phone: string, code: string) {
  const tok = await db.verificationToken.findFirst({
    where: { type: "PHONE_OTP", target: phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const invalid = new AppError(400, "INVALID_CODE", "Invalid or expired code");
  if (!tok || tok.expiresAt < new Date() || !tok.userId) throw invalid;
  if (tok.attempts >= A.otpMaxAttempts) throw invalid;
  if (tok.tokenHash !== sha256(`PHONE_OTP:${code}`)) {
    await db.verificationToken.update({ where: { id: tok.id }, data: { attempts: { increment: 1 } } });
    throw invalid;
  }
  await db.verificationToken.update({ where: { id: tok.id }, data: { consumedAt: new Date() } });
  const user = await db.user.update({ where: { id: tok.userId }, data: { phoneVerifiedAt: new Date() } });
  if (!user.isActive) throw new AppError(403, "ACCOUNT_DISABLED", "Account disabled");
  await audit({ actorId: user.id, action: "user.login_otp", entityType: "user", entityId: user.id });
  return user;
}

export function assertVerifiedForReporting(u: { emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null }) {
  if (appConfig.reports.requireVerifiedContact && !u.emailVerifiedAt && !u.phoneVerifiedAt) {
    throw new AppError(403, "UNVERIFIED", "Verify your e-mail or phone first");
  }
}

export { Errors };
