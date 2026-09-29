import { requireStaffPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";
import { can } from "@/lib/rbac/policy";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listUsers, listRoles } from "@/server/services/admin";
import { AutoSubmitForm } from "@/components/admin/AutoSubmitForm";
import { CreateStaffUser, UserRowActions } from "@/components/admin/UsersAdmin";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; page?: string }> }) {
  const me = await requireStaffPage("/admin/users", PERMISSIONS.USER_READ);
  const { t, locale } = await getT();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [data, roles, departments] = await Promise.all([
    listUsers(me, { q: sp.q, role: sp.role, page, pageSize: 25 }),
    listRoles(),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const canManage = can(me, PERMISSIONS.USER_MANAGE);
  const roleOpts = roles.map((r) => ({ key: r.key, name: r.name }));
  const deptOpts = departments.map((d) => ({ id: d.id, name: d.name }));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {t("admin.users.title")} <span className="text-base font-normal text-slate-500">({data.total})</span>
        </h1>
        {canManage && <CreateStaffUser roles={roleOpts} departments={deptOpts} />}
      </div>
      <AutoSubmitForm action="/admin/users" className="flex flex-wrap gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <label className="sr-only" htmlFor="uq">{t("common.search")}</label>
        <input id="uq" name="q" type="search" defaultValue={sp.q} placeholder={t("admin.users.search")} className="input min-w-56 flex-1 py-2 text-sm" />
        <select name="role" defaultValue={sp.role ?? ""} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm" aria-label={t("admin.users.role")}>
          <option value="">{t("admin.users.role")}: {t("common.all")}</option>
          {roles.map((r) => (
            <option key={r.key} value={r.key}>{r.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-primary px-3 text-white" aria-label={t("common.search")}><Icon name="search" size={18} /></button>
      </AutoSubmitForm>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2.5">{t("auth.lastName")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.users.role")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.users.employee")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.users.status")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.users.lastLogin")}</th>
              <th scope="col" className="px-3 py-2.5 text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2.5">
                  <span className="font-semibold">{u.firstName} {u.lastName}</span>
                  <span className="block text-xs text-slate-500">{u.email}{u.phone && ` · ${u.phone}`}</span>
                </td>
                <td className="px-3 py-2.5">{u.role.name}</td>
                <td className="px-3 py-2.5 text-slate-700">{u.employee?.isActive ? u.employee.department.name : "—"}</td>
                <td className="px-3 py-2.5">
                  <span className={cn("rounded px-2 py-0.5 text-xs font-semibold", u.isActive ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700")}>
                    {u.isActive ? t("admin.users.active") : t("admin.users.inactive")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-700">{u.lastLoginAt ? formatDate(u.lastLoginAt, locale) : "—"}</td>
                <td className="px-3 py-2.5">
                  <UserRowActions
                    canManage={canManage}
                    isSelf={u.id === me.id}
                    roles={roleOpts}
                    departments={deptOpts}
                    user={{
                      id: u.id,
                      name: `${u.firstName} ${u.lastName}`,
                      email: u.email,
                      phone: u.phone,
                      role: u.role.key,
                      isActive: u.isActive,
                      departmentId: u.employee?.isActive ? u.employee.departmentId : null,
                      jobTitle: u.employee?.jobTitle ?? null,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={data.page}
        pages={data.pages}
        hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.role ? { role: sp.role } : {}), page: String(p) })}`}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { page: data.page, pages: data.pages }) }}
      />
    </div>
  );
}
