import { requireStaffPage } from "@/lib/auth/guards";
import { can } from "@/lib/rbac/policy";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac/permissions";
import { AdminShell, type AdminNavItem } from "@/components/admin/AdminShell";

export const metadata = { title: { default: "Back-office", template: "%s · Back-office" }, robots: { index: false } };

const NAV: (AdminNavItem & { perm: PermissionKey })[] = [
  { href: "/admin", label: "admin.nav.dashboard", icon: "chart", perm: PERMISSIONS.STATS_READ },
  { href: "/admin/reports", label: "admin.nav.reports", icon: "list", perm: PERMISSIONS.REPORT_READ_ANY },
  { href: "/admin/users", label: "admin.nav.users", icon: "users", perm: PERMISSIONS.USER_READ },
  { href: "/admin/categories", label: "admin.nav.categories", icon: "tag", perm: PERMISSIONS.CATEGORY_MANAGE },
  { href: "/admin/departments", label: "admin.nav.departments", icon: "building", perm: PERMISSIONS.DEPARTMENT_MANAGE },
  { href: "/admin/workflow", label: "admin.nav.workflow", icon: "flow", perm: PERMISSIONS.WORKFLOW_MANAGE },
  { href: "/admin/audit", label: "admin.nav.audit", icon: "shield", perm: PERMISSIONS.AUDIT_READ },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage("/admin");
  return (
    <AdminShell
      nav={NAV.filter((n) => can(user, n.perm)).map(({ perm: _p, ...n }) => n)}
      user={{ name: `${user.firstName} ${user.lastName}`, role: user.roleName }}
    >
      {children}
    </AdminShell>
  );
}
