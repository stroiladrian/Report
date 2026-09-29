import Link from "next/link";
import { requireUserPage } from "@/lib/auth/guards";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n/server";
import { reportFiltersSchema } from "@/lib/validation/schemas";
import { listReports } from "@/server/services/reports";
import { statusGroups } from "@/server/services/workflow";
import { ReportCard } from "@/components/reports/ReportCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";

export const metadata = { title: "My reports" };

export default async function MyReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requireUserPage("/account/reports");
  const { t, locale } = await getT();
  const sp = await searchParams;
  const filters = reportFiltersSchema.parse({ mine: "1", period: "all", status: sp.status, page: sp.page, pageSize: "10" });
  const [data, groups] = await Promise.all([listReports(filters, user, locale), statusGroups(locale)]);
  const tab = (key: string | undefined, label: string) => (
    <Link
      key={key ?? "all"}
      href={key ? `/account/reports?status=${key}` : "/account/reports"}
      aria-current={sp.status === key ? "page" : undefined}
      className={cn(
        "whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold",
        sp.status === key ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t("account.reports")}</h2>
        <div className="flex gap-2">
          <ButtonLink href="/?mine=1" variant="outline" size="sm" icon="map">
            {t("map.viewMap")}
          </ButtonLink>
          <ButtonLink href="/submit" size="sm" icon="plus" className="bg-accent border-accent hover:bg-accent-dark">
            {t("header.reportIssue")}
          </ButtonLink>
        </div>
      </div>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" aria-label={t("filters.status")}>
        {tab(undefined, t("common.all"))}
        {groups.map((g) => tab(g.key, g.label))}
      </nav>
      {data.items.length === 0 ? (
        <EmptyState
          icon="list"
          title={t("account.noReports")}
          action={
            <ButtonLink href="/submit" icon="plus">
              {t("header.reportIssue")}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-2">
          {data.items.map((r) => (
            <li key={r.id}>
              <ReportCard report={r} locale={locale} href={`/reports/${r.number}`} />
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={data.page}
        pages={data.pages}
        hrefFor={(p) => `/account/reports?${new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), page: String(p) })}`}
        labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { page: data.page, pages: data.pages }) }}
      />
    </div>
  );
}
