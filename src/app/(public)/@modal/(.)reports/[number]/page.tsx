import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { AppError } from "@/lib/errors";
import { getReportDetail } from "@/server/services/reports";
import { ReportDetailView } from "@/components/reports/ReportDetailView";
import { RouteModal } from "@/components/reports/RouteModal";

/** Report detail rendered as a dialog over the map (intercepted route, like the reference). */
export default async function ReportModal({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);
  let report;
  try {
    report = await getReportDetail(decodeURIComponent(number), user, locale);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
  return (
    <RouteModal title={report.number}>
      <ReportDetailView report={report} t={t} locale={locale} variant="modal" />
    </RouteModal>
  );
}
