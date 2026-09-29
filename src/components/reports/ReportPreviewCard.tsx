"use client";

import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/core";
import type { MapReportDTO } from "@/types/reports";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

/** Hover card shown over a map point (desktop). */
export function ReportPreviewCard({ report, onOpen }: { report: MapReportDTO; onOpen: () => void }) {
  const { t, locale } = useI18n();
  return (
    <div className="w-[320px] bg-white text-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <span className="font-bold">{report.number}</span>
        <StatusBadge label={report.statusLabel} color={report.color} size="sm" />
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <p className="text-xs text-slate-500">
          {report.category} · {formatDate(report.createdAt, locale)}
        </p>
        <p className="font-semibold leading-snug">{report.title}</p>
        <p className="line-clamp-3 text-sm text-slate-700">{report.excerpt}</p>
        {report.photos.length > 0 && (
          <div className="flex gap-1.5">
            {report.photos.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={t("map.photo", { n: i + 1 })} width={68} height={68} loading="lazy" className="h-[68px] w-[68px] rounded bg-slate-200 object-cover" />
            ))}
          </div>
        )}
        <div className="flex justify-end pt-1">
          <Button size="sm" iconRight="arrowRight" onClick={onOpen}>
            {t("map.openDetails")}
          </Button>
        </div>
      </div>
    </div>
  );
}
