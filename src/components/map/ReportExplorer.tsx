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
import { MapView, type Bbox, type LngLat } from "./MapView";
import { NearbyCard, distanceM } from "./NearbyCards";
import { branding } from "@config/branding";
import { mapBus } from "@/lib/map-bus";
import { useTheme } from "@/lib/theme/client";

type Facets = { statuses: StatusGroupDTO[]; categories: CategoryFacet[] };

/**
 * Home screen: full-screen map under a floating header, report cards along the bottom
 * (swipe ↔ map follows; tap a marker → its card), filters in a panel / bottom sheet,
 * optional list panel. Filter state lives in the URL.
 */
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
  const [desktopFilters, setDesktopFilters] = useState(true);
  const theme = useTheme() ?? branding.publicTheme.defaultMode;
  const [userPos, setUserPos] = useState<LngLat | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [inset, setInset] = useState(0);
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

  // Header ↔ explorer bridge (search/filters + locate buttons live in the header).
  useEffect(() => {
    mapBus.set({ explorer: true });
    return () => mapBus.set({ explorer: false, filterCount: 0 });
  }, []);
  useEffect(() => mapBus.set({ filterCount: count }), [count]);
  useEffect(
    () =>
      mapBus.on("filters", () => {
        if (window.matchMedia("(min-width: 768px)").matches) setDesktopFilters((v) => !v);
        else setMobileFilters(true);
      }),
    [],
  );

  // Cards: nearest reports to the visitor (or to the town centre until they share their location).
  const anchor = userPos ?? branding.map.defaultLocation;
  const cards = useMemo(() => {
    const sorted = points
      .map((r) => ({ r, d: distanceM(anchor, r) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 40);
    if (selectedId && !sorted.some((x) => x.r.id === selectedId)) {
      const r = points.find((p) => p.id === selectedId);
      if (r) sorted.unshift({ r, d: distanceM(anchor, r) });
    }
    return sorted;
  }, [points, anchor.lat, anchor.lng, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rail = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const programmatic = useRef(false);

  // Bottom overlay height → camera padding + attribution offset.
  useEffect(() => {
    const el = bottom.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInset(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [listOpen]);

  const scrollToCard = (id: string) => {
    const el = cardEls.current.get(id);
    if (!el || !rail.current) return;
    programmatic.current = true;
    el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    window.setTimeout(() => (programmatic.current = false), 700);
  };

  // Marker tap: first tap selects (and brings its card into view), a second tap opens it.
  const onMarker = (r: MapReportDTO) => {
    if (selectedId === r.id) return openReport(r.number);
    setSelectedId(r.id);
    requestAnimationFrame(() => scrollToCard(r.id));
  };

  // Swiping the cards: the card closest to the centre becomes the selection and the map follows.
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onRailScroll = () => {
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const box = rail.current?.getBoundingClientRect();
      if (!box || programmatic.current) return;
      const mid = box.left + box.width / 2;
      let best: { id: string; d: number } | null = null;
      for (const [id, el] of cardEls.current) {
        const b = el.getBoundingClientRect();
        const d = Math.abs(b.left + b.width / 2 - mid);
        if (!best || d < best.d) best = { id, d };
      }
      if (best && best.id !== selectedId) {
        setSelectedId(best.id);
        setFocus((f) => ({ id: best!.id, n: (f?.n ?? 0) + 1 }));
      }
    }, 140);
  };

  const panel = (
    <FilterPanel filters={filters} statuses={facets.statuses} categories={facets.categories} onChange={update} loggedIn={loggedIn} />
  );

  return (
    <div className="relative flex h-dvh overflow-hidden bg-background" style={{ "--cr-map-bottom": `${inset}px` } as React.CSSProperties}>
      <div className="relative min-w-0 flex-1">
        <MapView
          reports={points}
          heatmap={false}
          theme={theme}
          selectedId={selectedId}
          focus={focus}
          bottomInset={listOpen ? 0 : inset}
          onSelect={onMarker}
          onOpen={(r) => openReport(r.number)}
          onBoundsChange={(b) => setBbox(b)}
          onUserLocation={(p) => {
            setUserPos(p);
            setSelectedId(null);
            requestAnimationFrame(() => rail.current?.scrollTo({ left: 0, behavior: "smooth" }));
          }}
          className="absolute inset-0"
        />

        {/* Desktop filter card (toggled by the header's search button) */}
        {desktopFilters && (
          <div
            className="absolute left-6 top-20 z-10 hidden w-80 overflow-y-auto rounded-3xl md:block cr-glass"
            style={{ maxHeight: `calc(100% - ${inset + 96}px)` }}
          >
            {panel}
          </div>
        )}

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

        {(filters.mine || loading || error) && (
          <div className="absolute left-1/2 top-[76px] z-10 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
            {filters.mine && <span className="rounded-full px-3 py-1.5 text-sm font-semibold cr-glass">{t("filters.mineActive")}</span>}
            {loading ? (
              <span className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium cr-glass">
                <Spinner size={16} /> {t("map.loading")}
              </span>
            ) : error ? (
              <button type="button" onClick={() => setReload((x) => x + 1)} className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-card">
                <Icon name="alert" size={16} /> {t("map.error")} {t("common.retry")}
              </button>
            ) : null}
          </div>
        )}

        {/* Bottom: actions row + swipeable report cards */}
        {!listOpen && (
          <div ref={bottom} className="pointer-events-none absolute inset-x-0 bottom-0 z-10 pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="pointer-events-auto mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 sm:px-6">
              <button
                type="button"
                onClick={() => update({ view: "list", page: 1 })}
                aria-label={`${t("map.viewList")} (${points.length})`}
                className="flex h-11 items-center gap-2 rounded-full pl-3.5 pr-2 text-[15px] font-semibold text-foreground transition active:scale-95 cr-glass"
              >
                <Icon name="list" size={18} />
                {t("map.viewList")}
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs tabular-nums">{points.length}</span>
              </button>
              <Link
                href="/submit"
                className="cr-gloss inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-semibold text-on-primary transition hover:bg-primary-dark active:scale-95"
              >
                <Icon name="plus" size={18} strokeWidth={2.6} />
                {t("header.reportIssue")}
              </Link>
            </div>
            {cards.length > 0 && (
              <div
                ref={rail}
                onScroll={onRailScroll}
                role="list"
                aria-label={userPos ? t("map.nearby") : t("map.nearbyCenter")}
                className="cr-snap pointer-events-auto mt-1 flex gap-3 overflow-x-auto px-4 pb-1 sm:px-6 md:[mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)]"
              >
                {cards.map(({ r, d }) => (
                  <div role="listitem" key={r.id} className="flex">
                    <NearbyCard
                      ref={(el) => {
                        if (el) cardEls.current.set(r.id, el);
                        else cardEls.current.delete(r.id);
                      }}
                      report={r}
                      distance={userPos ? d : null}
                      selected={selectedId === r.id}
                      onSelect={() => {
                        setSelectedId(r.id);
                        setFocus((f) => ({ id: r.id, n: (f?.n ?? 0) + 1 }));
                      }}
                      onOpen={() => openReport(r.number)}
                    />
                  </div>
                ))}
                <div aria-hidden="true" className="w-1 shrink-0" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* List panel: side panel on desktop, full-screen on mobile */}
      {listOpen && (
        <aside
          aria-label={t("list.title")}
          className="absolute inset-0 z-20 flex flex-col bg-background pt-16 md:static md:w-[420px] md:shrink-0 md:border-l md:border-slate-200 lg:w-[460px]"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
            <h2 className="text-lg font-bold">{t("list.title")}</h2>
            {list && <span className="text-sm text-muted">({list.total})</span>}
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="outline" icon="filter" className="md:hidden" onClick={() => setMobileFilters(true)}>
                {count > 0 ? count : ""}
              </Button>
              <Button size="sm" variant="ghost" icon="map" onClick={() => update({ view: "map", page: 1 })}>
                {t("map.viewMap")}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2 text-sm">
            <label className="flex items-center gap-1.5">
              <span className="font-semibold">{t("filters.sort")}:</span>
              <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as FilterState["sort"], page: 1 })} className="rounded-full border border-slate-300 bg-surface-secondary px-3 py-1">
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
