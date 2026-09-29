/**
 * Permission catalogue + default role matrix.
 * The matrix is only used by the seed; at runtime permissions are read from
 * the database (roles ↔ permissions), so super-admins can change them.
 */
export const PERMISSIONS = {
  REPORT_CREATE: "report:create",
  REPORT_READ_OWN: "report:read_own",
  REPORT_COMMENT_OWN: "report:comment_own",
  REPORT_READ_ANY: "report:read_any",
  REPORT_PROCESS_ASSIGNED: "report:process_assigned",
  REPORT_PROCESS_ANY: "report:process_any",
  REPORT_ASSIGN: "report:assign",
  REPORT_EDIT: "report:edit",
  REPORT_COMMENT_INTERNAL: "report:comment_internal",
  REPORT_COMMENT_PUBLIC: "report:comment_public",
  ATTACHMENT_UPLOAD_ADMIN: "attachment:upload_admin",
  STATS_READ: "stats:read",
  USER_READ: "user:read",
  USER_MANAGE: "user:manage",
  CATEGORY_MANAGE: "category:manage",
  DEPARTMENT_MANAGE: "department:manage",
  WORKFLOW_MANAGE: "workflow:manage",
  ROLE_MANAGE: "role:manage",
  AUDIT_READ: "audit:read",
  CONFIG_MANAGE: "config:manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "report:create": "Submit new reports",
  "report:read_own": "View own reports including private details",
  "report:comment_own": "Add information to own reports",
  "report:read_any": "View every report including non-public data and reporter contact",
  "report:process_assigned": "Change status / add updates on reports assigned to self or own department",
  "report:process_any": "Process any report",
  "report:assign": "Assign reports to departments and operators",
  "report:edit": "Edit title, category, location and visibility of reports",
  "report:comment_internal": "Add internal notes",
  "report:comment_public": "Publish updates and official responses",
  "attachment:upload_admin": "Upload administrative attachments",
  "stats:read": "View dashboard statistics",
  "user:read": "View users",
  "user:manage": "Create, (de)activate users and change roles",
  "category:manage": "Manage categories",
  "department:manage": "Manage departments and employees",
  "workflow:manage": "Configure statuses and transitions",
  "role:manage": "Manage roles and permissions",
  "audit:read": "Read the audit log",
  "config:manage": "Manage system configuration",
};

export const ROLE_KEYS = {
  CITIZEN: "CITIZEN",
  OPERATOR: "OPERATOR",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

const P = PERMISSIONS;
const CITIZEN: PermissionKey[] = [P.REPORT_CREATE, P.REPORT_READ_OWN, P.REPORT_COMMENT_OWN];
const OPERATOR: PermissionKey[] = [
  ...CITIZEN,
  P.REPORT_READ_ANY,
  P.REPORT_PROCESS_ASSIGNED,
  P.REPORT_COMMENT_INTERNAL,
  P.REPORT_COMMENT_PUBLIC,
  P.ATTACHMENT_UPLOAD_ADMIN,
  P.STATS_READ,
];
const ADMIN: PermissionKey[] = [
  ...OPERATOR,
  P.REPORT_PROCESS_ANY,
  P.REPORT_ASSIGN,
  P.REPORT_EDIT,
  P.USER_READ,
  P.USER_MANAGE,
  P.CATEGORY_MANAGE,
  P.DEPARTMENT_MANAGE,
  P.AUDIT_READ,
];
const SUPER_ADMIN: PermissionKey[] = Object.values(P);

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  CITIZEN,
  OPERATOR,
  ADMIN,
  SUPER_ADMIN,
};

/** Roles whose members can open the back-office. */
export const STAFF_PERMISSION: PermissionKey = P.REPORT_READ_ANY;
