import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "@/lib/rbac/permissions";
import { can, canAssignRole, canCommentAsCitizen, canProcessReport, canViewPrivate, canViewReport, type Actor } from "@/lib/rbac/policy";

const actor = (roleKey: keyof typeof DEFAULT_ROLE_PERMISSIONS, extra: Partial<Actor> = {}): Actor => ({
  id: `${roleKey}-1`,
  roleKey,
  permissions: new Set(DEFAULT_ROLE_PERMISSIONS[roleKey]),
  isActive: true,
  ...extra,
});

const report = { reporterId: "CITIZEN-1", assigneeId: "emp-1", departmentId: "dept-1", isPublic: true, categorySensitive: false };

describe("role matrix", () => {
  it("citizens can create and read own, not read any", () => {
    const c = actor("CITIZEN");
    expect(can(c, PERMISSIONS.REPORT_CREATE)).toBe(true);
    expect(can(c, PERMISSIONS.REPORT_READ_ANY)).toBe(false);
    expect(can(c, PERMISSIONS.USER_MANAGE)).toBe(false);
  });
  it("only super admins manage workflow and roles", () => {
    expect(can(actor("ADMIN"), PERMISSIONS.WORKFLOW_MANAGE)).toBe(false);
    expect(can(actor("SUPER_ADMIN"), PERMISSIONS.WORKFLOW_MANAGE)).toBe(true);
    expect(can(actor("SUPER_ADMIN"), PERMISSIONS.ROLE_MANAGE)).toBe(true);
  });
  it("deactivated users have no permissions", () => {
    expect(can(actor("ADMIN", { isActive: false }), PERMISSIONS.REPORT_READ_ANY)).toBe(false);
  });
  it("anonymous has no permissions", () => {
    expect(can(null, PERMISSIONS.REPORT_CREATE)).toBe(false);
  });
});

describe("report policies", () => {
  it("operators process reports assigned to them or their department only", () => {
    expect(canProcessReport(actor("OPERATOR", { employeeId: "emp-1", departmentId: "x" }), report)).toBe(true);
    expect(canProcessReport(actor("OPERATOR", { employeeId: "emp-2", departmentId: "dept-1" }), report)).toBe(true);
    expect(canProcessReport(actor("OPERATOR", { employeeId: "emp-2", departmentId: "dept-2" }), report)).toBe(false);
    expect(canProcessReport(actor("ADMIN"), report)).toBe(true);
    expect(canProcessReport(actor("CITIZEN"), report)).toBe(false);
  });
  it("sensitive or hidden reports are only visible to owner and staff", () => {
    const hidden = { ...report, isPublic: false };
    expect(canViewReport(null, report)).toBe(true);
    expect(canViewReport(null, hidden)).toBe(false);
    expect(canViewReport(actor("CITIZEN"), hidden)).toBe(true); // owner
    expect(canViewReport(actor("CITIZEN", { id: "someone" }), hidden)).toBe(false);
    expect(canViewReport(actor("OPERATOR"), { ...report, categorySensitive: true })).toBe(true);
    expect(canViewPrivate(actor("CITIZEN"))).toBe(false);
  });
  it("only the reporter can add citizen comments", () => {
    expect(canCommentAsCitizen(actor("CITIZEN"), report)).toBe(true);
    expect(canCommentAsCitizen(actor("CITIZEN", { id: "other" }), report)).toBe(false);
  });
  it("admins cannot grant admin roles, super admins can", () => {
    expect(canAssignRole(actor("ADMIN"), "OPERATOR")).toBe(true);
    expect(canAssignRole(actor("ADMIN"), "SUPER_ADMIN")).toBe(false);
    expect(canAssignRole(actor("ADMIN"), "ADMIN")).toBe(false);
    expect(canAssignRole(actor("ADMIN"), "CITIZEN", "ADMIN")).toBe(false);
    expect(canAssignRole(actor("SUPER_ADMIN"), "SUPER_ADMIN")).toBe(true);
    expect(canAssignRole(actor("OPERATOR"), "CITIZEN")).toBe(false);
  });
});
