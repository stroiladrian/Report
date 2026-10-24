import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { cn } from "@/lib/cn";
import { formatDate, tr } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";
import { adminReportQuerySchema } from "@/lib/validation/schemas";
import { adminListReports } from "@/server/services/reports";
import { loadWorkflow } from "@/server/services/workflow";
import { AutoSubmitForm } from "@/components/admin/AutoSubmitForm";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/States";

export const metadata = { title: "Reports" };

type SP = Record<string, string | undefined>;

export default async function AdminReports({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireStaffPage("/admin/reports");
  const { t, locale } = await getT();
  const sp = await searchParams;
  const q = adminReportQuerySchema.parse(sp);
  const [data, { rows: statuses }, categories, departments] = await Promise.all([
    adminListReports(user, q, locale),
    loadWorkflow(),
    db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" } }),
    db.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = (patch: SP) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/admin/reports?${p.toString()}`;
  };
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([, v]) => !!v) as [string, string][]).toString();
  const sel = "rounded-md border border-slate-300 bg-white px-2 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">
          {t("admin.reports.title")} <span className="text-base font-normal text-slate-500">({data.total})</span>
        </h1>
        <a href={`/api/admin/reports/export?${exportQs}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50">
          <Icon name="download" size={16} /> {t("admin.reports.export")}
        </a>
      </div>

      <AutoSubmitForm action="/admin/reports" className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="min-w-56 flex-1">
          <label htmlFor="q" className="sr-only">
            {t("common.search")}
          </label>
          <div className="flex">
            <input id="q" name="q" type="search" defaultValue={q.q} placeholder={t("admin.reports.search")} className="input rounded-r-none py-2 text-sm" />
            <button type="submit" className="rounded-r-md bg-primary px-3 text-white" aria-label={t("common.search")}>
              <Icon name="search" size={18} />
            </button>
          </div>
        </div>
        <label className="text-sm">
          <span className="sr-only">{t("filters.status")}</span>
          <select name="status" defaultValue={sp.status ?? ""} className={sel}>
            <option value="">{t("filters.status")}: {t("common.all")}</option>
            {statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {tr(s.label, locale)}
              </option>
            ))}
            {sp.status?.includes(",") && <option value={sp.status}>{sp.status}</option>}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">{t("filters.category")}</span>
          <select name="category" defaultValue={sp.category ?? ""} className={sel}>
            <option value="">{t("filters.category")}: {t("common.all")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {tr(c.name, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">{t("admin.reports.department")}</span>
          <select name="department" defaultValue={sp.department ?? ""} className={sel}>
            <option value="">{t("admin.reports.department")}: {t("common.all")}</option>
            <option value="none">— {t("admin.reports.unassigned")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">{t("admin.reports.assignee")}</span>
          <select name="assignee" defaultValue={sp.assignee ?? ""} className={sel}>
            <option value="">{t("admin.reports.assignee")}: {t("common.all")}</option>
            {user.employeeId && <option value="me">{t("admin.reports.onlyMine")}</option>}
            <option value="none">{t("admin.reports.unassigned")}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">{t("filters.sort")}</span>
          <select name="sort" defaultValue={q.sort} className={sel}>
            <option value="newest">{t("filters.sortNewest")}</option>
            <option value="oldest">{t("filters.sortOldest")}</option>
            <option value="updated">{t("filters.sortUpdated")}</option>
            <option value="due">{t("admin.reports.due")}</option>
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-1.5 text-sm font-medium">
          <input type="checkbox" name="overdue" value="1" defaultChecked={q.overdue} className="h-4 w-4" /> {t("admin.reports.onlyOverdue")}
        </label>
        {Object.values(sp).some(Boolean) && (
          <Link href="/admin/reports" className="link min-h-10 content-center text-sm">
            {t("common.clearFilters")}
          </Link>
        )}
      </AutoSubmitForm>

      {data.items.length === 0 ? (
        <div className="rounded-lg bg-white ring-1 ring-slate-200">
          <EmptyState icon="search" title={t("admin.reports.empty")} />
        </div>
      ) : (
        <>
          {/* Table (≥ md) */}
          <div className="hidden overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2.5">{t("report.number")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("create.description.title")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("report.status")}</th>
                  <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">{t("admin.reports.department")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("admin.reports.assignee")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("admin.reports.created")}</th>
                  <th scope="col" className="px-3 py-2.5">{t("admin.reports.due")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold">
                      <Link href={`/admin/reports/${r.number}`} className="text-primary hover:underline">
                        {r.number}
                      </Link>
                      {!r.isPublic && <Icon name="eyeOff" size={14} className="ml-1 inline text-slate-400" label="private" />}
                    </td>
                    <td className="max-w-xs px-3 py-2.5">
                      <span className="line-clamp-1 font-medium">{r.title}</span>
                      <span className="line-clamp-1 text-xs text-slate-500">
                        {r.category}
                        {r.address && ` · ${r.address}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={r.status.label} color={r.status.color} size="sm" />
                    </td>
                    <td className="hidden max-w-[12rem] px-3 py-2.5 text-slate-700 lg:table-cell">
                      <span className="line-clamp-1">{r.department ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{r.assignee ?? <span className="text-slate-400">{t("admin.reports.unassigned")}</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{formatDate(r.createdAt, locale)}</td>
                    <td className={cn("whitespace-nowrap px-3 py-2.5", r.overdue ? "font-semibold text-red-700" : "text-slate-700")}>
                      {r.dueAt ? formatDate(r.dueAt, locale) : "—"}
                      {r.overdue && <span className="sr-only"> ({t("admin.reports.overdue")})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Cards (< md) */}
          <ul className="space-y-2 md:hidden">
            {data.items.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/reports/${r.number}`} className="block rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-primary">{r.number}</span>
                    <StatusBadge label={r.status.label} color={r.status.color} size="sm" />
                  </div>
                  <p className="mt-1 font-medium">{r.title}</p>
                  <p className="text-xs text-slate-500">
                    {r.category} · {formatDate(r.createdAt, locale)}
                    {r.overdue && <span className="font-semibold text-red-700"> · {t("admin.reports.overdue")}</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Pagination
        page={data.page}
        pages={data.pages}
        hrefFor={(p) => qs({ page: String(p) })}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { page: data.page, pages: data.pages }) }}
      />
    </div>
  );
}
