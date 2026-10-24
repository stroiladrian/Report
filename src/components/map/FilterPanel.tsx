"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { formatDate, type TKey } from "@/lib/i18n/core";
import type { FilterState, Period } from "@/lib/filters";
import type { CategoryFacet, StatusGroupDTO } from "@/types/reports";
import { Icon } from "@/components/ui/Icon";
import { StatusDot } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

type Props = {
  filters: FilterState;
  statuses: StatusGroupDTO[];
  categories: CategoryFacet[];
  onChange: (patch: Partial<FilterState>) => void;
  loggedIn: boolean;
  className?: string;
  defaultOpen?: Section[];
};

type Section = "status" | "category" | "period" | "search";

const PERIOD_LABEL: Record<Period, TKey> = {
  "7d": "filters.last7",
  "30d": "filters.last30",
  "90d": "filters.last90",
  "365d": "filters.last365",
  all: "filters.allTime",
};

function AccordionItem({
  id,
  title,
  summary,
  aside,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary?: React.ReactNode;
  /** Interactive content shown next to the header button (not inside it). */
  aside?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <div className="flex items-center gap-2">
      <h3 className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-btn`}
          onClick={onToggle}
          className="flex min-h-10 w-full items-center gap-1.5 py-2 text-left text-sm font-bold hover:text-primary"
        >
          <Icon name="chevronRight" size={14} strokeWidth={3} className={cn("shrink-0 transition-transform", open && "rotate-90")} />
          <span>{title}</span>
          {summary && <span className="ml-auto flex items-center gap-1 text-xs font-normal text-slate-500">{summary}</span>}
        </button>
      </h3>
      {aside}
      </div>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} hidden={!open} className="pb-3">
        {children}
      </div>
    </div>
  );
}

/** Floating accordion filter card (status / category / period / search), modelled on the reference. */
export function FilterPanel({ filters, statuses, categories, onChange, loggedIn, className, defaultOpen = [] }: Props) {
  const { t, locale } = useI18n();
  const uid = useId();
  const [open, setOpen] = useState<Section[]>(defaultOpen);
  // Tooltip is position:fixed so the panel's scroll container can't clip it.
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const showTip = (el: HTMLElement, text: string) => {
    const r = el.getBoundingClientRect();
    setTip({ text, x: r.left + r.width / 2, y: r.bottom + 6 });
  };
  const toggle = (s: Section) => setOpen((o) => (o.includes(s) ? o.filter((x) => x !== s) : [...o, s]));

  const allStatus = statuses.map((s) => s.key);
  const selStatus = filters.status ?? allStatus;
  const allCats = categories.map((c) => c.slug);
  const selCats = filters.category ?? allCats;

  const setStatus = (next: string[]) => onChange({ status: next.length === allStatus.length ? null : next, page: 1 });
  const setCats = (next: string[]) => onChange({ category: next.length === allCats.length ? null : next, page: 1 });

  // Period draft (Apply/Reset like the reference)
  const [draft, setDraft] = useState({ from: filters.from ?? "", to: filters.to ?? "" });
  useEffect(() => setDraft({ from: filters.from ?? "", to: filters.to ?? "" }), [filters.from, filters.to]);
  const [q, setQ] = useState(filters.q);
  useEffect(() => setQ(filters.q), [filters.q]);

  const periodSummary =
    filters.from || filters.to
      ? t("filters.custom", { from: filters.from ? formatDate(filters.from, locale) : "…", to: filters.to ? formatDate(filters.to, locale) : "…" })
      : t(PERIOD_LABEL[filters.period ?? (filters.mine ? "365d" : "30d")]);

  return (
    <div className={cn("rounded-md bg-white px-3 shadow-card ring-1 ring-black/5", className)}>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[60] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" aria-hidden="true" />
        </div>
      )}
      <AccordionItem
        id={`${uid}-st`}
        title={t("filters.status")}
        open={open.includes("status")}
        onToggle={() => toggle("status")}
        aside={
          !open.includes("status") && (
            <div className="flex items-center gap-1" role="group" aria-label={t("filters.status")}>
              {statuses.map((s) => {
                const on = selStatus.includes(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${s.label}: ${s.count}`}
                    onClick={() => setStatus(on ? selStatus.filter((x) => x !== s.key) : [...selStatus, s.key])}
                    className="group relative grid h-6 w-5 place-items-center"
                    onMouseEnter={(e) => showTip(e.currentTarget, `${s.label}: ${s.count}`)}
                    onFocus={(e) => showTip(e.currentTarget, `${s.label}: ${s.count}`)}
                    onMouseLeave={() => setTip(null)}
                    onBlur={() => setTip(null)}
                  >
                    <StatusDot color={s.color} hollow={!on} className="transition-transform group-hover:scale-125 group-focus-visible:scale-125" />
                  </button>
                );
              })}
            </div>
          )
        }
      >
        <ul className="space-y-0.5">
          {statuses.map((s) => {
            const on = selStatus.includes(s.key);
            return (
              <li key={s.key}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => setStatus(on ? selStatus.filter((x) => x !== s.key) : [...selStatus, s.key])}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded px-1 text-left text-sm font-semibold hover:bg-slate-50",
                    !on && "text-slate-400",
                  )}
                >
                  <StatusDot color={s.color} hollow={!on} />
                  <span className="flex-1">{s.label}</span>
                  <span className="text-xs tabular-nums text-slate-500">{s.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </AccordionItem>

      <AccordionItem id={`${uid}-cat`} title={t("filters.category")} open={open.includes("category")} onToggle={() => toggle("category")}>
        <ul className="max-h-[40vh] space-y-0.5 overflow-y-auto pr-1">
          {categories.map((c) => {
            const on = selCats.includes(c.slug);
            return (
              <li key={c.slug}>
                <label className={cn("flex min-h-9 cursor-pointer items-center gap-2 rounded px-1 text-sm font-semibold hover:bg-slate-50", !on && "text-slate-500")}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setCats(on ? selCats.filter((x) => x !== c.slug) : [...selCats, c.slug])}
                    className="h-4 w-4 shrink-0 accent-[rgb(var(--c-primary))]"
                  />
                  <span className="flex-1 leading-tight">{c.name}</span>
                  <span className="text-xs tabular-nums text-slate-500">{c.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <button type="button" className="link mt-2 text-sm" onClick={() => setCats(selCats.length ? [] : allCats)}>
          {selCats.length ? t("filters.deselectAll") : t("filters.selectAll")}
        </button>
      </AccordionItem>

      <AccordionItem id={`${uid}-per`} title={t("filters.period")} open={open.includes("period")} onToggle={() => toggle("period")} summary={!open.includes("period") && periodSummary}>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => {
            const active = !filters.from && !filters.to && (filters.period ?? (filters.mine ? "365d" : "30d")) === p;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ period: p, from: null, to: null, page: 1 })}
                className={cn(
                  "min-h-8 rounded-full border px-2.5 text-xs font-semibold",
                  active ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500",
                )}
              >
                {t(PERIOD_LABEL[p])}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-2 text-sm">
          <label htmlFor={`${uid}-from`} className="font-semibold">
            {t("filters.from")}:
          </label>
          <input id={`${uid}-from`} type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="input py-1 text-sm" />
          <label htmlFor={`${uid}-to`} className="font-semibold">
            {t("filters.to")}:
          </label>
          <input id={`${uid}-to`} type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="input py-1 text-sm" />
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onChange({ from: null, to: null, period: null, page: 1 })}>
            {t("common.reset")}
          </Button>
          <Button
            size="sm"
            fullWidth
            disabled={draft.from === (filters.from ?? "") && draft.to === (filters.to ?? "")}
            onClick={() => onChange({ from: draft.from || null, to: draft.to || null, page: 1 })}
          >
            {t("common.apply")}
          </Button>
        </div>
      </AccordionItem>

      <AccordionItem id={`${uid}-q`} title={t("filters.search")} open={open.includes("search")} onToggle={() => toggle("search")} summary={!open.includes("search") && filters.q}>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            onChange({ q: q.trim(), page: 1 });
          }}
          className="flex gap-2"
        >
          <label htmlFor={`${uid}-qi`} className="sr-only">
            {t("filters.search")}
          </label>
          <input id={`${uid}-qi`} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("filters.searchPlaceholder")} className="input py-1.5 text-sm" maxLength={100} />
          <Button type="submit" size="sm" aria-label={t("common.search")} icon="search" />
        </form>
      </AccordionItem>

      {loggedIn && (
        <div className="border-t border-slate-200 py-2">
          {filters.mine ? (
            <button type="button" onClick={() => onChange({ mine: false, page: 1 })} className="flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <Icon name="map" size={16} /> {t("filters.showAll")}
            </button>
          ) : (
            <Link href="/?mine=1" onClick={(e) => { e.preventDefault(); onChange({ mine: true, page: 1 }); }} className="flex min-h-9 items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-primary">
              <Icon name="user" size={16} /> {t("filters.mine")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
