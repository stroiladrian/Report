import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { appConfig } from "@config/app";
import { randomToken, sha256 } from "./crypto";
import type { Actor } from "@/lib/rbac/policy";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cr_session" : "cr_session";
const MAX_AGE = appConfig.auth.sessionDays * 86_400;

export type SessionUser = Actor & {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  locale: string;
  roleName: string;
};

function secureCookies() {
  return process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "1";
}

export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null } = {}) {
  const token = randomToken(32);
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt: new Date(Date.now() + MAX_AGE * 1000),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      ip: meta.ip ?? null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function loadActor(userId: string): Promise<SessionUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      employee: true,
    },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    locale: user.locale,
    roleKey: user.role.key,
    roleName: user.role.name,
    permissions: new Set(user.role.permissions.map((rp) => rp.permission.key)),
    employeeId: user.employee?.isActive ? user.employee.id : null,
    departmentId: user.employee?.isActive ? user.employee.departmentId : null,
    isActive: user.isActive,
  };
}

/** Current user for this request (memoised per request). Null when anonymous. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: sha256(token) } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // sliding refresh at most once an hour
  if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + MAX_AGE * 1000) },
      })
      .catch(() => undefined);
  }
  return loadActor(session.userId);
});

export async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
  };
}
