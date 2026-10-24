import { formatDate, formatTime, type Locale } from "@/lib/i18n/core";
import type { HistoryEntryDTO } from "@/types/reports";

/** Vertical status timeline: date/time on the left, coloured node, status pill + optional note. */
export function ReportTimeline({ history, locale, showActor }: { history: HistoryEntryDTO[]; locale: Locale; showActor?: boolean }) {
  return (
    <ol className="relative">
      {history.map((h, i) => (
        <li key={h.id} className="relative grid grid-cols-[4.75rem_1.25rem_1fr] gap-x-2 pb-5 last:pb-0">
          <div className="text-right text-sm leading-tight text-slate-700">
            <time dateTime={h.at}>
              <span className="block">{formatDate(h.at, locale)}</span>
              <span className="block text-slate-500">{formatTime(h.at, locale)}</span>
            </time>
          </div>
          <div className="relative flex justify-center">
            {i < history.length - 1 && <span className="absolute top-4 h-[calc(100%+0.25rem)] w-0.5 bg-slate-300" aria-hidden="true" />}
            <span className="relative z-10 mt-1 h-4 w-4 rounded-full border-2 border-slate-100" style={{ backgroundColor: h.status.color }} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="inline-block rounded px-2 py-0.5 text-sm font-bold text-white" style={{ backgroundColor: h.status.color }}>
              {h.status.label}
            </span>
            {h.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{h.note}</p>}
            {showActor && h.actorName && <p className="mt-0.5 text-xs text-slate-500">{h.actorName}{!h.isPublic && " · 🔒"}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
