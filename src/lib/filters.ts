/**
 * Public filter state ⇄ URL query string.
 *   /?status=in_progress,resolved&category=roads&period=30d&q=…&view=list&mine=1
 * Absent `status` / `category` means "all".
 */
export type Period = "7d" | "30d" | "90d" | "365d" | "all";
export type ViewMode = "map" | "list";

export type FilterState = {
  status: string[] | null; // null = all
  category: string[] | null; // null = all
  period: Period | null; // null = default
  from: string | null;
  to: string | null;
  q: string;
  mine: boolean;
  view: ViewMode;
  sort: "newest" | "oldest" | "updated";
  page: number;
  inView: boolean;
};

const PERIODS: Period[] = ["7d", "30d", "90d", "365d", "all"];
const NONE = "-";

export function parseFilters(sp: URLSearchParams | Record<string, string | string[] | undefined>): FilterState {
  const get = (k: string) => {
    if (sp instanceof URLSearchParams) return sp.get(k);
    const v = sp[k];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };
  const list = (k: string) => {
    const v = get(k);
    if (v == null) return null;
    if (v === NONE || v === "") return [];
    return v.split(",").filter(Boolean);
  };
  const period = get("period") as Period | null;
  const sort = get("sort");
  return {
    status: list("status"),
    category: list("category"),
    period: period && PERIODS.includes(period) ? period : null,
    from: /^\d{4}-\d{2}-\d{2}$/.test(get("from") ?? "") ? get("from") : null,
    to: /^\d{4}-\d{2}-\d{2}$/.test(get("to") ?? "") ? get("to") : null,
    q: (get("q") ?? "").slice(0, 100),
    mine: get("mine") === "1",
    view: get("view") === "list" ? "list" : "map",
    sort: sort === "oldest" || sort === "updated" ? sort : "newest",
    page: Math.max(1, Number(get("page")) || 1),
    inView: get("inview") === "1",
  };
}

/** Query string for the URL bar (only non-default values). */
export function toSearch(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status.length ? f.status.join(",") : NONE);
  if (f.category) p.set("category", f.category.length ? f.category.join(",") : NONE);
  if (f.from || f.to) {
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
  } else if (f.period) p.set("period", f.period);
  if (f.q) p.set("q", f.q);
  if (f.mine) p.set("mine", "1");
  if (f.view === "list") p.set("view", "list");
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (f.page > 1) p.set("page", String(f.page));
  if (f.inView) p.set("inview", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Query string for the API (omits UI-only keys). */
export function toApiQuery(f: FilterState, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status.length ? f.status.join(",") : "__none__");
  if (f.category) p.set("category", f.category.length ? f.category.join(",") : "__none__");
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (!f.from && !f.to && f.period) p.set("period", f.period);
  if (f.q) p.set("q", f.q);
  if (f.mine) p.set("mine", "1");
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

export function activeFilterCount(f: FilterState): number {
  return [f.status !== null, f.category !== null, !!(f.period || f.from || f.to), !!f.q].filter(Boolean).length;
}
