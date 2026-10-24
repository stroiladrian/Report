import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";
import { can } from "@/lib/rbac/policy";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listCategories } from "@/server/services/categories";
import { getAdminReportDetail } from "@/server/services/reports";
import {
  AssignmentCard,
  AttachmentsCard,
  AuditCard,
  ClassificationCard,
  ConversationCard,
  LocationCard,
  WorkflowCard,
} from "@/components/admin/ReportAdminPanel";
import { ReportTimeline } from "@/components/reports/Timeline";
import { StatusBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export default async function AdminReportPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await requireStaffPage(`/admin/reports/${number}`);
  const { t, locale } = await getT();
  let report;
  try {
    report = await getAdminReportDetail(decodeURIComponent(number), user, locale);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  const [categories, departments] = await Promise.all([
    listCategories(locale),
    db.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { employees: { where: { isActive: true }, include: { user: true } } },
    }),
  ]);
  const depts = departments.map((d) => ({ id: d.id, name: d.name, employees: d.employees.map((e) => ({ id: e.id, name: `${e.user.firstName} ${e.user.lastName}` })) }));

  return (
    <div className="space-y-4">
      <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <Icon name="arrowLeft" size={16} /> {t("admin.reports.title")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="font-bold text-slate-900">{report.number}</span>
            <StatusBadge label={report.status.label} color={report.status.color} size="sm" />
            {!report.isPublic && (
              <span className="inline-flex items-center gap-1 rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold">
                <Icon name="eyeOff" size={12} /> {t("admin.detail.internal")}
              </span>
            )}
          </p>
          <h1 className="mt-1 text-2xl font-bold">{report.title}</h1>
          <p className="text-sm text-slate-500">
            {report.category.name}
            {report.subcategory && ` › ${report.subcategory.name}`} · {formatDateTime(report.createdAt, locale)}
          </p>
        </div>
        <a href={`/reports/${report.number}`} target="_blank" className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-50">
          <Icon name="external" size={16} /> {t("admin.nav.publicSite")}
        </a>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-2 font-bold">{t("report.description")}</h2>
            <p className="whitespace-pre-wrap text-slate-800">{report.description}</p>
            {(report.redirectedTo || report.resolution) && (
              <div className="mt-3 space-y-1 rounded bg-slate-50 p-3 text-sm">
                {report.redirectedTo && (
                  <p>
                    <b>{t("report.redirectedTo")}:</b> {report.redirectedTo}
                  </p>
                )}
                {report.resolution && (
                  <p>
                    <b>{t("report.resolution")}:</b> {report.resolution}
                  </p>
                )}
              </div>
            )}
          </section>
          <AttachmentsCard report={report} canUpload={can(user, PERMISSIONS.ATTACHMENT_UPLOAD_ADMIN)} />
          <ConversationCard report={report} canPublic={can(user, PERMISSIONS.REPORT_COMMENT_PUBLIC)} canInternal={can(user, PERMISSIONS.REPORT_COMMENT_INTERNAL)} />
          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 font-bold">{t("report.history")}</h2>
            <ReportTimeline history={report.history} locale={locale} showActor />
          </section>
          <AuditCard report={report} />
        </div>
        <div className="space-y-4">
          <WorkflowCard report={report} />
          <AssignmentCard report={report} departments={depts} />
          <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-2 font-bold">{t("admin.detail.reporter")}</h2>
            {report.reporter ? (
              <dl className="space-y-1 text-sm">
                <dt className="sr-only">{t("admin.detail.reporter")}</dt>
                <dd className="font-semibold">{report.reporter.name}</dd>
                {report.reporter.email && (
                  <dd>
                    <a className="link" href={`mailto:${report.reporter.email}`}>
                      {report.reporter.email}
                    </a>
                  </dd>
                )}
                {report.reporter.phone && (
                  <dd>
                    <a className="link" href={`tel:${report.reporter.phone}`}>
                      {report.reporter.phone}
                    </a>
                  </dd>
                )}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">—</p>
            )}
          </section>
          <LocationCard report={report} />
          <ClassificationCard report={report} categories={categories} />
        </div>
      </div>
    </div>
  );
}
