import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n/server";
import { can } from "@/lib/rbac/policy";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { dashboardStats } from "@/server/services/admin";
import { DailyBars, HBars } from "@/components/admin/Charts";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireStaffPage("/admin");
  if (!can(user, PERMISSIONS.STATS_READ)) redirect("/admin/reports");
  const { t, locale } = await getT();
  const s = await dashboardStats(user, locale);
  const tiles: { label: string; value: number; href: string; icon: IconName; tone?: string }[] = [
    { label: t("admin.stats.total"), value: s.total, href: "/admin/reports", icon: "list" },
    { label: t("admin.stats.new"), value: s.kpis.new, href: "/admin/reports?status=submitted,accepted", icon: "bell" },
    { label: t("admin.stats.assigned"), value: s.kpis.assigned, href: "/admin/reports?status=assigned", icon: "user" },
    { label: t("admin.stats.inProgress"), value: s.kpis.inProgress, href: "/admin/reports?status=in_progress,needs_info", icon: "clock" },
    { label: t("admin.stats.planned"), value: s.kpis.planned, href: "/admin/reports?status=planned", icon: "calendar" },
    { label: t("admin.stats.resolved"), value: s.kpis.resolved, href: "/admin/reports?status=resolved,closed", icon: "check" },
    { label: t("admin.stats.redirected"), value: s.kpis.redirected, href: "/admin/reports?status=redirected", icon: "arrowRight" },
    { label: t("admin.stats.overdue"), value: s.kpis.overdue, href: "/admin/reports?overdue=1", icon: "alert", tone: s.kpis.overdue ? "text-red-700" : undefined },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("admin.nav.dashboard")}</h1>
        {user.employeeId && (
          <Link href="/admin/reports?assignee=me" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 font-semibold text-white hover:bg-primary-dark">
            <Icon name="user" size={18} /> {t("admin.stats.myQueue")} <span className="rounded-full bg-white/20 px-2 text-sm">{s.kpis.mine}</span>
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link href={tile.href} className="block rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:ring-primary">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <Icon name={tile.icon} size={16} /> {tile.label}
              </span>
              <span className={cn("mt-1 block text-3xl font-extrabold tabular-nums", tile.tone)}>{tile.value}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h2 className="mb-3 font-bold">{t("admin.stats.last30")}</h2>
          <DailyBars data={s.last30} locale={locale} label={t("admin.stats.last30")} />
        </section>
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-bold">{t("filters.status")}</h2>
          <ul className="space-y-1.5 text-sm">
            {s.statusCounts.map((st) => (
              <li key={st.key}>
                <Link href={`/admin/reports?status=${st.key}`} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: st.color }} aria-hidden="true" />
                  <span className="flex-1">{st.label}</span>
                  <span className="font-semibold tabular-nums">{st.count}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
            {t("admin.stats.avgResolution")}: <b className="text-slate-900">{t("admin.stats.days", { n: s.avgResolutionDays })}</b>
          </p>
        </section>
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h2 className="mb-3 font-bold">{t("admin.stats.byCategory")}</h2>
          <HBars rows={s.byCategory} empty={t("admin.reports.empty")} />
        </section>
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-bold">{t("admin.stats.byDepartment")}</h2>
          <HBars rows={s.byDepartment.map((d) => ({ name: d.name ?? t("admin.reports.unassigned"), count: d.count }))} empty={t("admin.reports.empty")} />
        </section>
      </div>
    </div>
  );
}
