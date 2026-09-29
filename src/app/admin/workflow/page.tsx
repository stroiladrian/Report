import { requireStaffPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { StatusEditor, TransitionMatrix, type StatusRow } from "@/components/admin/WorkflowEditor";

export const metadata = { title: "Workflow" };

export default async function WorkflowPage() {
  await requireStaffPage("/admin/workflow", PERMISSIONS.WORKFLOW_MANAGE);
  const { t, locale } = await getT();
  const [statuses, transitions] = await Promise.all([
    db.reportStatus.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { reports: true } } } }),
    db.statusTransition.findMany(),
  ]);
  const rows: StatusRow[] = statuses.map((s) => ({
    id: s.id,
    key: s.key,
    label: s.label as StatusRow["label"],
    pluralLabel: (s.pluralLabel ?? s.label) as StatusRow["pluralLabel"],
    publicGroup: s.publicGroup,
    color: s.color,
    sortOrder: s.sortOrder,
    isInitial: s.isInitial,
    isTerminal: s.isTerminal,
    isResolved: s.isResolved,
    isActive: s.isActive,
    count: s._count.reports,
  }));
  const groups = [...new Set(rows.map((r) => r.publicGroup))];
  const yes = (b: boolean) => (b ? "✓" : "");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("admin.workflow.title")}</h1>
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{t("admin.workflow.statuses")}</h2>
          <StatusEditor mode="new" groups={groups} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-2 py-2">{t("admin.workflow.key")}</th>
                <th scope="col" className="px-2 py-2">{t("report.status")}</th>
                <th scope="col" className="px-2 py-2">{t("admin.workflow.group")}</th>
                <th scope="col" className="px-2 py-2">{t("admin.workflow.initial")}</th>
                <th scope="col" className="px-2 py-2">{t("admin.workflow.terminal")}</th>
                <th scope="col" className="px-2 py-2">{t("admin.workflow.resolvedFlag")}</th>
                <th scope="col" className="px-2 py-2">#</th>
                <th scope="col" className="px-2 py-2"><span className="sr-only">{t("common.actions")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} className={s.isActive ? "" : "opacity-50"}>
                  <td className="px-2 py-2"><code className="text-xs">{s.key}</code></td>
                  <td className="px-2 py-2">
                    <span className="rounded px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: s.color }}>{s.label[locale]}</span>
                  </td>
                  <td className="px-2 py-2"><code className="text-xs">{s.publicGroup}</code></td>
                  <td className="px-2 py-2">{yes(s.isInitial)}</td>
                  <td className="px-2 py-2">{yes(s.isTerminal)}</td>
                  <td className="px-2 py-2">{yes(s.isResolved)}</td>
                  <td className="px-2 py-2 tabular-nums">{s.count}</td>
                  <td className="px-2 py-2 text-right"><StatusEditor mode="edit" status={s} groups={groups} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-3 font-bold">{t("admin.workflow.transitions")}</h2>
        <TransitionMatrix statuses={rows} transitions={transitions.map((x) => ({ fromStatusId: x.fromStatusId, toStatusId: x.toStatusId, requiresComment: x.requiresComment }))} canEdit />
      </section>
    </div>
  );
}
