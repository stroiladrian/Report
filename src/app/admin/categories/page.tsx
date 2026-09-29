import { requireStaffPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { tr } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { adminListCategories } from "@/server/services/categories";
import { CategoryEditor, emptyCategory, type CategoryFormValue } from "@/components/admin/CategoryEditor";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireStaffPage("/admin/categories", PERMISSIONS.CATEGORY_MANAGE);
  const { t, locale } = await getT();
  const [cats, departments] = await Promise.all([adminListCategories(), db.department.findMany({ orderBy: { name: "asc" } })]);
  const parents = cats.filter((c) => !c.parentId);
  const deptOpts = departments.map((d) => ({ id: d.id, name: d.name }));
  const parentOpts = parents.map((p) => ({ id: p.id, name: tr(p.name, locale) }));
  const toForm = (c: (typeof cats)[number]): CategoryFormValue => {
    const n = (c.name ?? {}) as Record<string, string>;
    const no = (c.notice ?? {}) as Record<string, string>;
    return {
      id: c.id, slug: c.slug, nameRo: n.ro ?? "", nameEn: n.en ?? "", noticeRo: no.ro ?? "", noticeEn: no.en ?? "", color: c.color,
      parentId: c.parentId ?? "", departmentId: c.departmentId ?? "", slaDays: c.slaDays?.toString() ?? "", isSensitive: c.isSensitive, isActive: c.isActive, sortOrder: String(c.sortOrder),
    };
  };
  const row = (c: (typeof cats)[number], child = false) => (
    <tr key={c.id} className={cn(!c.isActive && "opacity-50")}>
      <td className={cn("px-3 py-2", child && "pl-9")}>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden="true" />
          <span className={cn(!child && "font-semibold")}>{tr(c.name, locale)}</span>
          {c.isSensitive && <span className="rounded bg-slate-800 px-1.5 text-xs text-white">🔒</span>}
        </span>
        <span className="block pl-5 text-xs text-slate-500">{c.slug}</span>
      </td>
      <td className="px-3 py-2 text-slate-700">{c.department?.name ?? "—"}</td>
      <td className="px-3 py-2 tabular-nums">{c.slaDays ?? "—"}</td>
      <td className="px-3 py-2 tabular-nums">{c._count.reports + c._count.subReports}</td>
      <td className="px-3 py-2 text-right">
        <CategoryEditor initial={toForm(c)} parents={parentOpts} departments={deptOpts} mode="edit" />
      </td>
    </tr>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("admin.categories.title")}</h1>
        <CategoryEditor initial={emptyCategory} parents={parentOpts} departments={deptOpts} mode="new" />
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2.5">{t("admin.departments.name")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.categories.department")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.categories.sla")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.reports.title")}</th>
              <th scope="col" className="px-3 py-2.5"><span className="sr-only">{t("common.actions")}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parents.flatMap((p) => [row(p), ...cats.filter((c) => c.parentId === p.id).map((c) => row(c, true))])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
