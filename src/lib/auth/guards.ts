import "server-only";
import { redirect } from "next/navigation";
import { Errors } from "@/lib/errors";
import { can, isStaff } from "@/lib/rbac/policy";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { getCurrentUser, type SessionUser } from "./session";

/** For API routes: throws 401 when anonymous. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw Errors.unauthorized();
  return u;
}

/** For API routes: throws 401/403. */
export async function requirePermission(perm: PermissionKey): Promise<SessionUser> {
  const u = await requireUser();
  if (!can(u, perm)) throw Errors.forbidden();
  return u;
}

/** For pages: redirect to login when anonymous. */
export async function requireUserPage(returnTo: string): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return u;
}

/** For admin pages. */
export async function requireStaffPage(returnTo: string, perm?: PermissionKey): Promise<SessionUser> {
  const u = await requireUserPage(returnTo);
  if (!isStaff(u) || (perm && !can(u, perm))) redirect("/forbidden");
  return u;
}
