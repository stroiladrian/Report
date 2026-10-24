import { requireStaffPage } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listDepartments } from "@/server/services/admin";
import { DepartmentEditor } from "@/components/admin/DepartmentEditor";
import { Icon } from "@/components/ui/Icon";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  await requireStaffPage("/admin/departments", PERMISSIONS.DEPARTMENT_MANAGE);
  const { t } = await getT();
  const depts = await listDepartments();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("admin.departments.title")}</h1>
        <DepartmentEditor mode="new" />
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {depts.map((d) => (
          <li key={d.id} className={`rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 ${d.isActive ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-500">{d.code}</p>
                <h2 className="font-bold">{d.name}</h2>
              </div>
              <DepartmentEditor mode="edit" initial={{ id: d.id, code: d.code, name: d.name, email: d.email ?? "", phone: d.phone ?? "", isActive: d.isActive }} />
            </div>
            {d.email && (
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                <Icon name="mail" size={14} /> {d.email}
              </p>
            )}
            <p className="mt-2 text-sm text-slate-600">
              {t("admin.departments.categories")}: <b>{d._count.categories}</b> · {t("admin.reports.title")}: <b>{d._count.reports}</b>
            </p>
            <p className="mt-2 text-sm font-semibold">{t("admin.departments.employees")}</p>
            <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
              {d.employees.length === 0 && <li className="text-slate-400">—</li>}
              {d.employees.map((e) => (
                <li key={e.id}>
                  {e.user.firstName} {e.user.lastName}
                  {e.jobTitle && <span className="text-slate-500"> · {e.jobTitle}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
