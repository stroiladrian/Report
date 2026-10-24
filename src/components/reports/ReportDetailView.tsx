import Link from "next/link";
import { formatDate, formatDateTime, type Locale, type TFunction } from "@/lib/i18n/core";
import type { ReportDetailDTO } from "@/types/reports";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { MiniMap } from "@/components/map/MiniMap";
import { PhotoGallery } from "./PhotoGallery";
import { ReportTimeline } from "./Timeline";
import { CitizenReply } from "./CitizenReply";
import { ShareButton } from "./ShareButton";

/** Public report detail (used by the map modal and the full page). */
export function ReportDetailView({ report: r, t, locale, variant = "page" }: { report: ReportDetailDTO; t: TFunction; locale: Locale; variant?: "page" | "modal" }) {
  const images = r.attachments.filter((a) => a.isImage);
  const docs = r.attachments.filter((a) => !a.isImage);
  const updates = r.comments.filter((c) => c.kind !== "NOTE");
  const address = r.location ? r.location.formattedAddress ?? [r.location.street, r.location.streetNumber].filter(Boolean).join(" ") : null;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          {variant === "page" && (
            <p className="mb-2 text-sm font-semibold text-slate-500">
              {r.number} · {r.category.name}
            </p>
          )}
          <h2 className={variant === "page" ? "text-2xl font-bold sm:text-3xl" : "text-xl font-bold"}>{r.title}</h2>
          {r.viewer.isOwner && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded bg-primary-light px-2 py-1 text-sm font-semibold text-primary-dark">
              <Icon name="user" size={16} /> {t("report.yourReport")}
            </p>
          )}
          <p className="mt-4 whitespace-pre-wrap break-words text-slate-700">{r.description}</p>
        </div>

        {images.length > 0 && (
          <section aria-labelledby="photos-h">
            <h3 id="photos-h" className="mb-2 font-bold">
              {t("report.photos")}
            </h3>
            <PhotoGallery photos={images} />
          </section>
        )}
        {docs.length > 0 && (
          <section aria-labelledby="docs-h">
            <h3 id="docs-h" className="mb-2 font-bold">
              {t("report.attachments")}
            </h3>
            <ul className="space-y-1">
              {docs.map((d) => (
                <li key={d.id}>
                  <a href={`${d.url}?download=1`} className="link inline-flex items-center gap-1.5">
                    <Icon name="file" size={16} /> {d.name} <span className="text-xs text-slate-500">({Math.ceil(d.size / 1024)} KB)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(r.resolution || r.redirectedTo) && (
          <section className="rounded-lg border-l-4 p-4" style={{ borderColor: r.status.color, backgroundColor: `${r.status.color}12` }}>
            {r.redirectedTo && (
              <p>
                <span className="font-bold">{t("report.redirectedTo")}:</span> {r.redirectedTo}
              </p>
            )}
            {r.resolution && (
              <p>
                <span className="font-bold">{t("report.resolution")}:</span> {r.resolution}
              </p>
            )}
          </section>
        )}

        <section aria-labelledby="updates-h">
          <h3 id="updates-h" className="mb-2 font-bold">
            {t("report.updates")}
          </h3>
          {updates.length === 0 ? (
            <p className="text-sm text-slate-500">{t("report.noUpdates")}</p>
          ) : (
            <ul className="space-y-3">
              {updates.map((c) => (
                <li
                  key={c.id}
                  className={
                    c.kind === "CITIZEN"
                      ? "ml-6 rounded-lg border border-slate-200 bg-white p-3"
                      : c.kind === "RESPONSE"
                        ? "rounded-lg border border-green-200 bg-green-50 p-3"
                        : "rounded-lg border border-slate-200 bg-slate-50 p-3"
                  }
                >
                  <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {c.kind === "RESPONSE" ? t("report.response") : c.kind === "CITIZEN" ? t("admin.detail.citizen") : c.authorName}
                    </span>
                    <time dateTime={c.at}>{formatDateTime(c.at, locale)}</time>
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          {r.viewer.canComment && (
            <div className="mt-4">
              <CitizenReply reportId={r.id} />
            </div>
          )}
        </section>
      </div>

      <div className="space-y-4">
        <section className="panel" aria-label={t("common.details")}>
          <dl className="space-y-3">
            <div>
              <dt className="font-bold">{t("report.number")}</dt>
              <dd className="mt-1">{r.number}</dd>
            </div>
            <div>
              <dt className="font-bold">{t("report.status")}</dt>
              <dd className="mt-1">
                <StatusBadge label={r.status.label} color={r.status.color} size="lg" />
              </dd>
            </div>
            <div>
              <dt className="font-bold">{t("report.category")}</dt>
              <dd>{r.category.name}</dd>
            </div>
            {r.subcategory && (
              <div>
                <dt className="font-bold">{t("report.subcategory")}</dt>
                <dd>{r.subcategory.name}</dd>
              </div>
            )}
            <div>
              <dt className="font-bold">{t("report.location")}</dt>
              <dd className="text-slate-700">
                {address || (r.location ? `${r.location.lat.toFixed(5)}, ${r.location.lng.toFixed(5)}` : t("map.noLocation"))}
                {r.location?.district && <span className="block text-sm text-slate-500">{r.location.district}</span>}
              </dd>
            </div>
            <div>
              <dt className="font-bold">{t("report.submitted")}</dt>
              <dd>{formatDateTime(r.createdAt, locale)}</dd>
            </div>
            {r.dueAt && !r.status.isTerminal && !r.status.isResolved && (
              <div>
                <dt className="font-bold">{t("report.dueAt")}</dt>
                <dd>{formatDate(r.dueAt, locale)}</dd>
              </div>
            )}
          </dl>
          {r.location && (
            <>
              <MiniMap lat={r.location.lat} lng={r.location.lng} color={r.status.color} className="mt-4 h-44 w-full overflow-hidden rounded" label={t("report.location")} />
              <Link href={`/?view=map`} className="sr-only">
                {t("report.viewOnMap")}
              </Link>
            </>
          )}
        </section>
        <section className="panel" aria-labelledby="hist-h">
          <h3 id="hist-h" className="mb-4 font-bold">
            {t("report.history")}
          </h3>
          <ReportTimeline history={r.history} locale={locale} />
        </section>
        <div className="flex flex-wrap gap-2">
          <ShareButton path={`/reports/${r.number}`} title={r.title} />
          {variant === "modal" && (
            <a href={`/reports/${r.number}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50">
              <Icon name="external" size={16} /> {t("report.fullPage")}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
