/**
 * Pure authorization policies. No I/O – easy to unit test.
 * Every API route / service calls these; the UI only uses them to hide
 * controls, never as the source of truth.
 */
import { Errors } from "../errors";
import { PERMISSIONS, ROLE_KEYS, type PermissionKey } from "./permissions";

export type Actor = {
  id: string;
  roleKey: string;
  permissions: ReadonlySet<string>;
  employeeId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
};

export type ReportScope = {
  reporterId: string | null;
  assigneeId: string | null;
  departmentId: string | null;
  isPublic: boolean;
  categorySensitive?: boolean;
};

export function can(actor: Actor | null | undefined, perm: PermissionKey): boolean {
  if (!actor || actor.isActive === false) return false;
  return actor.permissions.has(perm);
}

export function assertCan(actor: Actor | null | undefined, perm: PermissionKey): asserts actor is Actor {
  if (!actor) throw Errors.unauthorized();
  if (!can(actor, perm)) throw Errors.forbidden();
}

export function isStaff(actor: Actor | null | undefined): boolean {
  return can(actor, PERMISSIONS.REPORT_READ_ANY);
}

/** Can the actor see the report at all (public view or private view)? */
export function canViewReport(actor: Actor | null | undefined, r: ReportScope): boolean {
  if (r.isPublic && !r.categorySensitive) return true;
  if (!actor) return false;
  if (isStaff(actor)) return true;
  return r.reporterId === actor.id && can(actor, PERMISSIONS.REPORT_READ_OWN);
}

/** Can the actor see private data (reporter contact, internal notes, hidden attachments)? */
export function canViewPrivate(actor: Actor | null | undefined): boolean {
  return isStaff(actor);
}

/** Operators process reports assigned to them or to their department; admins process any. */
export function canProcessReport(actor: Actor | null | undefined, r: ReportScope): boolean {
  if (!actor) return false;
  if (can(actor, PERMISSIONS.REPORT_PROCESS_ANY)) return true;
  if (!can(actor, PERMISSIONS.REPORT_PROCESS_ASSIGNED)) return false;
  if (actor.employeeId && r.assigneeId === actor.employeeId) return true;
  if (actor.departmentId && r.departmentId === actor.departmentId) return true;
  return false;
}

export function assertCanProcess(actor: Actor | null | undefined, r: ReportScope): asserts actor is Actor {
  if (!actor) throw Errors.unauthorized();
  if (!canProcessReport(actor, r)) throw Errors.forbidden("You cannot process this report");
}

export function canCommentAsCitizen(actor: Actor | null | undefined, r: ReportScope): boolean {
  return !!actor && r.reporterId === actor.id && can(actor, PERMISSIONS.REPORT_COMMENT_OWN);
}

/** Role hierarchy guard – only SUPER_ADMIN can grant/revoke SUPER_ADMIN or ADMIN. */
export function canAssignRole(actor: Actor | null | undefined, targetRoleKey: string, currentRoleKey?: string): boolean {
  if (!can(actor, PERMISSIONS.USER_MANAGE)) return false;
  const privileged: string[] = [ROLE_KEYS.SUPER_ADMIN, ROLE_KEYS.ADMIN];
  if (actor!.roleKey === ROLE_KEYS.SUPER_ADMIN) return true;
  if (privileged.includes(targetRoleKey)) return false;
  if (currentRoleKey && privileged.includes(currentRoleKey)) return false;
  return true;
}
