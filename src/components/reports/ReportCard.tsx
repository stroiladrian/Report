import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDate, type Locale } from "@/lib/i18n/core";
import type { ListReportDTO } from "@/types/reports";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

/** Compact report card used in the public list, "My reports" and search results. */
export function ReportCard({ report, locale, href, className }: { report: ListReportDTO; locale: Locale; href: string; className?: string }) {
  return (
    <article
      className={cn("group relative flex gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:shadow-card focus-within:shadow-card", className)}
    >
      {report.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={report.photo} alt="" width={80} height={80} loading="lazy" className="h-20 w-20 shrink-0 rounded-md bg-slate-200 object-cover" />
      ) : (
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md" style={{ backgroundColor: `${report.category.color}1a`, color: report.category.color }} aria-hidden="true">
          <Icon name="pin" size={28} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge label={report.status.label} color={report.status.color} size="sm" />
          <span className="text-xs font-semibold text-slate-500">{report.number}</span>
        </div>
        <h3 className="mt-1 font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0 focus:outline-none">
            {report.title}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{report.excerpt}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
          <span>{report.category.name}</span>
          {report.address && (
            <span className="inline-flex items-center gap-0.5">
              <Icon name="pin" size={12} /> {report.address}
            </span>
          )}
          <span>{formatDate(report.createdAt, locale)}</span>
          {report.photoCount > 1 && (
            <span className="inline-flex items-center gap-0.5">
              <Icon name="camera" size={12} /> {report.photoCount}
            </span>
          )}
        </p>
      </div>
    </article>
  );
}
