"use client";

import { Button, Chip } from "@heroui/react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { categoryIcon } from "@/lib/category-icons";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@config/app";
import type { MapReportDTO } from "@/types/reports";
import { Icon } from "@/components/ui/Icon";
import type { LngLat } from "./MapView";

/** Great-circle distance in metres. */
export function distanceM(a: LngLat, b: LngLat) {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const formatDistance = (m: number, locale: Locale) =>
  m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(m / 1000)} km`;

function relative(iso: string, locale: Locale) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(days) < 1) return rtf.format(Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000), "hour");
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return rtf.format(Math.round(days / 30), "month");
}

type CardProps = {
  report: MapReportDTO;
  /** Metres from the visitor (only when their location is known). */
  distance: number | null;
  selected: boolean;
  onOpen: () => void;
  onSelect: () => void;
};

/** One report in the bottom carousel – modelled on the reference's place cards. */
export const NearbyCard = forwardRef<HTMLElement, CardProps>(function NearbyCard({ report: r, distance, selected, onOpen, onSelect }, ref) {
  const { t, locale } = useI18n();
  return (
    <article
      ref={ref}
      data-id={r.id}
      aria-label={r.title}
      className="relative w-[300px] max-w-[calc(100vw-56px)] shrink-0 pt-3.5"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button")) onSelect();
      }}
    >
      {/* Floating chip on the card edge: distance (or age when the location is unknown). */}
      <Chip size="sm" className="absolute left-4 top-0 z-10 gap-1.5 rounded-full border border-white/8 bg-surface-secondary px-2.5 py-1 text-[13px] text-muted shadow-sm [[data-theme=light]_&]:border-black/5">
        <Icon name={distance != null ? "route" : "clock"} size={14} className="text-foreground" />
        <Chip.Label>
          {distance != null ? (
            (() => {
              const [pre, post] = t("map.near", { distance: "\u0000" }).split("\u0000");
              return (
                <>
                  {pre}
                  <b className="font-semibold text-foreground">{formatDistance(distance, locale)}</b>
                  {post}
                </>
              );
            })()
          ) : (
            <span className="text-foreground">{relative(r.createdAt, locale)}</span>
          )}
        </Chip.Label>
      </Chip>

      <div
        className={cn(
          "flex h-full flex-col rounded-[22px] border bg-surface p-4 pt-5 transition-[border-color,box-shadow] duration-200",
          "shadow-[inset_0_1px_0_rgb(255_255_255/0.05),0_16px_36px_-18px_rgb(0_0_0/0.75)]",
          selected ? "border-primary/70 shadow-[0_0_0_1px_rgb(var(--c-primary)/0.5),0_16px_36px_-18px_rgb(0_0_0/0.75)]" : "border-white/8 [[data-theme=light]_&]:border-black/6",
        )}
      >
        <h3 className="truncate text-[19px] font-bold leading-tight text-foreground">{r.title}</h3>
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color, boxShadow: `0 0 8px ${r.color}` }} />
          <span className="truncate">
            {r.statusLabel} <span className="opacity-70">· {r.number}</span>
          </span>
        </p>
        <ul className="mt-3.5 space-y-2.5 text-[15px] text-foreground">
          <li className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full cr-well">
              <Icon name={categoryIcon(r.categoryKey)} size={18} />
            </span>
            <span className="truncate">{r.category}</span>
          </li>
          <li className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full cr-well">
              <Icon name="pin" size={18} />
            </span>
            <span className={cn("truncate", !r.address && "text-muted")}>{r.address ?? t("map.noAddress")}</span>
          </li>
        </ul>
        <div className="mt-4 flex items-center gap-2.5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("map.directions")}
            title={t("map.directions")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/12 text-foreground transition hover:bg-foreground/8 [[data-theme=light]_&]:border-black/10"
          >
            <Icon name="route" size={18} />
          </a>
          <Button variant="primary" size="lg" fullWidth onPress={onOpen} className="cr-gloss h-11 text-[15px] font-semibold">
            {t("map.details")}
          </Button>
        </div>
      </div>
    </article>
  );
});
