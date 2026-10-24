import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listAudit } from "@/server/services/admin";
import { AutoSubmitForm } from "@/components/admin/AutoSubmitForm";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entityType?: string; action?: string; page?: string }> }) {
  const me = await requireStaffPage("/admin/audit", PERMISSIONS.AUDIT_READ);
  const { t, locale } = await getT();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await listAudit(me, { entityType: sp.entityType || undefined, action: sp.action || undefined, page, pageSize: 50 });
  const reportIds = data.items.filter((i) => i.entityType === "report" && i.entityId).map((i) => i.entityId!);
  const numbers = new Map((await db.report.findMany({ where: { id: { in: reportIds } }, select: { id: true, number: true } })).map((r) => [r.id, r.number]));
  const types = ["report", "user", "category", "department", "status", "workflow"];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("admin.audit.title")}</h1>
      <AutoSubmitForm action="/admin/audit" className="flex flex-wrap gap-2 rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <select name="entityType" defaultValue={sp.entityType ?? ""} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm" aria-label={t("admin.audit.entity")}>
          <option value="">{t("admin.audit.entity")}: {t("common.all")}</option>
          {types.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <input name="action" defaultValue={sp.action} placeholder={`${t("admin.audit.action")} (report.status…)`} className="input max-w-xs py-2 text-sm" aria-label={t("admin.audit.action")} />
        <button type="submit" className="rounded-md bg-primary px-4 text-sm font-semibold text-white">{t("common.search")}</button>
      </AutoSubmitForm>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2.5">{t("admin.audit.when")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.audit.actor")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.audit.action")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.audit.entity")}</th>
              <th scope="col" className="px-3 py-2.5">{t("admin.audit.data")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((a) => (
              <tr key={a.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatDateTime(a.createdAt, locale)}</td>
                <td className="px-3 py-2">{a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : t("admin.audit.system")}</td>
                <td className="px-3 py-2"><code className="rounded bg-slate-100 px-1 text-xs">{a.action}</code></td>
                <td className="px-3 py-2">
                  {a.entityType === "report" && a.entityId && numbers.get(a.entityId) ? (
                    <Link className="link" href={`/admin/reports/${numbers.get(a.entityId)}`}>{numbers.get(a.entityId)}</Link>
                  ) : (
                    <span className="text-slate-600">{a.entityType}{a.entityId ? ` · ${a.entityId.slice(0, 8)}` : ""}</span>
                  )}
                </td>
                <td className="max-w-md px-3 py-2">
                  {a.data != null && <code className="line-clamp-2 break-all text-xs text-slate-600">{JSON.stringify(a.data)}</code>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={data.page}
        pages={data.pages}
        hrefFor={(p) => `/admin/audit?${new URLSearchParams({ ...(sp.entityType ? { entityType: sp.entityType } : {}), ...(sp.action ? { action: sp.action } : {}), page: String(p) })}`}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { page: data.page, pages: data.pages }) }}
      />
    </div>
  );
}
