"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { activeFilterCount, parseFilters, toApiQuery, toSearch, type FilterState } from "@/lib/filters";
import { useI18n } from "@/lib/i18n/client";
import type { CategoryFacet, ListReportDTO, MapReportDTO, Paginated, StatusGroupDTO } from "@/types/reports";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";
import { EmptyState, ErrorState, LoadingState, Spinner } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { ReportCard } from "@/components/reports/ReportCard";
import { FilterPanel } from "./FilterPanel";
import { MapView, type Bbox } from "./MapView";

type Facets = { statuses: StatusGroupDTO[]; categories: CategoryFacet[] };

/** Home screen: full-viewport map + floating filters + optional list panel. Filter state lives in the URL. */
export function ReportExplorer({ loggedIn }: { loggedIn: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  // While a report modal is open (intercepted route) the URL belongs to the modal –
  // keep the explorer's last filters instead of re-reading the modal's (empty) query string.
  const own = pathname === "/";
  const lastFilters = useRef<FilterState | null>(null);
  const filters = useMemo(() => {
    if (!own && lastFilters.current) return lastFilters.current;
    const f = parseFilters(new URLSearchParams(sp.toString()));
    lastFilters.current = f;
    return f;
  }, [sp, own]);

  const [points, setPoints] = useState<MapReportDTO[]>([]);
  const [facets, setFacets] = useState<Facets>({ statuses: [], categories: [] });
  const [list, setList] = useState<Paginated<ListReportDTO> | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState(false);
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [reload, setReload] = useState(0);

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      const next = { ...filters, ...patch };
      window.history.replaceState(null, "", `${pathname}${toSearch(next)}`);
    },
    [filters, pathname],
  );

  // Map points + facets (independent of list paging/sort).
  const dataKey = toApiQuery(filters);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    Promise.all([
      api<{ items: MapReportDTO[] }>(`/api/reports?format=map&${dataKey}`, { signal: ctrl.signal }),
      api<Facets>(`/api/reports/facets?${dataKey}`, { signal: ctrl.signal }),
    ])
      .then(([p, f]) => {
        setPoints(p.items);
        setFacets(f);
        setLoading(false);
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setError(true);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [dataKey, reload]);

  // List (only when visible).
  const bboxKey = filters.inView && bbox ? bbox.map((n) => n.toFixed(4)).join(",") : "";
  useEffect(() => {
    if (filters.view !== "list") return;
    const ctrl = new AbortController();
    setListLoading(true);
    const extra: Record<string, string> = { sort: filters.sort, page: String(filters.page), pageSize: "20" };
    if (bboxKey) extra.bbox = bboxKey;
    api<Paginated<ListReportDTO>>(`/api/reports?${toApiQuery(filters, extra)}`, { signal: ctrl.signal })
      .then((r) => {
        setList(r);
        setListLoading(false);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setListLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.view, dataKey, filters.sort, filters.page, bboxKey, reload]);

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => listRef.current?.scrollTo({ top: 0 }), [filters.page]);

  const openReport = useCallback((number: string) => router.push(`/reports/${number}`, { scroll: false }), [router]);
  const count = activeFilterCount(filters);
  const listOpen = filters.view === "list";

  const panel = (
    <FilterPanel filters={filters} statuses={facets.statuses} categories={facets.categories} onChange={update} loggedIn={loggedIn} />
  );

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] overflow-hidden sm:h-[calc(100dvh-4rem)]">
      <div className="relative min-w-0 flex-1">
        <MapView reports={points} heatmap={false} onOpen={(r) => openReport(r.number)} onBoundsChange={setBbox} className="absolute inset-0" />

        {/* Desktop filter card */}
        <div className="absolute left-6 top-4 z-10 hidden max-h-[calc(100%-7rem)] w-72 overflow-y-auto rounded-md md:block">{panel}</div>

        {/* Mobile filter trigger */}
        <div className="absolute left-4 top-4 z-10 sm:left-6 md:hidden">
          <Button variant="outline" size="md" icon="filter" onClick={() => setMobileFilters(true)} className="shadow-card">
            {t("common.filters")}
            {count > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-white">{count}</span>}
          </Button>
        </div>
        <Drawer open={mobileFilters} onClose={() => setMobileFilters(false)} title={t("common.filters")} side="bottom" closeLabel={t("common.close")}>
          <div className="p-3">
            <FilterPanel
              filters={filters}
              statuses={facets.statuses}
              categories={facets.categories}
              onChange={update}
              loggedIn={loggedIn}
              className="shadow-none ring-0"
              defaultOpen={["status", "category", "period"]}
            />
            <Button fullWidth className="mt-3" onClick={() => setMobileFilters(false)}>
              {t("map.reportsInView", { count: points.length })}
            </Button>
          </div>
        </Drawer>

        {filters.mine && (
          <div className="absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 rounded-full bg-slate-900/85 px-3 py-1.5 text-sm font-semibold text-white shadow md:block">
            {t("filters.mineActive")}
          </div>
        )}

        {(loading || error) && (
          <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 md:top-3" aria-live="polite">
            {loading ? (
              <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium shadow-card">
                <Spinner size={16} /> {t("map.loading")}
              </span>
            ) : (
              <button type="button" onClick={() => setReload((x) => x + 1)} className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-card">
                <Icon name="alert" size={16} /> {t("map.error")} {t("common.retry")}
              </button>
            )}
          </div>
        )}

        {/* Bottom controls */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center pb-[env(safe-area-inset-bottom)]">
          <Link
            href="/submit"
            className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-white bg-accent px-6 text-lg font-bold text-white shadow-lg hover:bg-accent-dark"
          >
            <Icon name="plus" size={20} strokeWidth={3} />
            {t("header.reportIssue")}
          </Link>
        </div>
        {!listOpen && (
          <button
            type="button"
            onClick={() => update({ view: "list", page: 1 })}
            aria-label={`${t("map.viewList")} (${points.length})`}
            title={t("map.viewList")}
            className="absolute bottom-24 right-4 z-10 flex h-11 sm:right-6 w-11 items-center justify-center rounded-full bg-white font-semibold shadow-card ring-1 ring-black/10 hover:bg-slate-50 sm:bottom-10 sm:w-auto sm:gap-2 sm:px-4"
          >
            <Icon name="list" size={20} />
            <span className="hidden sm:inline">{t("map.viewList")}</span>
            {/* Mobile: count as a small badge on the icon; desktop: inline pill */}
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] font-bold leading-5 text-white tabular-nums sm:static sm:min-w-0 sm:bg-slate-100 sm:px-1.5 sm:text-xs sm:font-semibold sm:leading-normal sm:text-slate-900">
              {points.length}
            </span>
          </button>
        )}
      </div>

      {/* List panel: side panel on desktop, full-screen on mobile */}
      {listOpen && (
        <aside
          aria-label={t("list.title")}
          className="absolute inset-0 z-20 flex flex-col bg-slate-50 md:static md:w-[420px] md:shrink-0 md:border-l md:border-slate-200 lg:w-[460px]"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <h2 className="text-lg font-bold">{t("list.title")}</h2>
            {list && <span className="text-sm text-slate-500">({list.total})</span>}
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="outline" icon="filter" className="md:hidden" onClick={() => setMobileFilters(true)}>
                {count > 0 ? count : ""}
              </Button>
              <Button size="sm" variant="ghost" icon="map" onClick={() => update({ view: "map", page: 1 })}>
                {t("map.viewMap")}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 text-sm">
            <label className="flex items-center gap-1.5">
              <span className="font-semibold">{t("filters.sort")}:</span>
              <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as FilterState["sort"], page: 1 })} className="rounded border border-slate-300 bg-white px-2 py-1">
                <option value="newest">{t("filters.sortNewest")}</option>
                <option value="oldest">{t("filters.sortOldest")}</option>
                <option value="updated">{t("filters.sortUpdated")}</option>
              </select>
            </label>
            <label className="hidden items-center gap-1.5 md:flex">
              <input type="checkbox" checked={filters.inView} onChange={(e) => update({ inView: e.target.checked, page: 1 })} className="h-4 w-4 accent-[rgb(var(--c-primary))]" />
              {t("filters.onlyInView")}
            </label>
          </div>
          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {listLoading && !list ? (
              <LoadingState label={t("common.loading")} />
            ) : error ? (
              <ErrorState title={t("map.error")} onRetry={() => setReload((x) => x + 1)} retryLabel={t("common.retry")} />
            ) : list && list.items.length === 0 ? (
              <EmptyState icon="search" title={t("list.empty")} text={t("list.emptyHint")} />
            ) : (
              <div className={cn("space-y-2", listLoading && "opacity-60")} aria-busy={listLoading}>
                {list?.items.map((r) => (
                  <ReportCard key={r.id} report={r} locale={locale} href={`/reports/${r.number}`} />
                ))}
              </div>
            )}
            {list && (
              <div className="pb-24 pt-2 md:pb-4">
                <Pagination
                  page={list.page}
                  pages={list.pages}
                  onPage={(p) => update({ page: p })}
                  labels={{ previous: t("common.previous"), next: t("common.next"), page: t("common.page", { page: list.page, pages: list.pages }) }}
                />
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
