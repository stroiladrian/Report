import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { AppError } from "@/lib/errors";
import { getReportDetail } from "@/server/services/reports";
import { ReportDetailView } from "@/components/reports/ReportDetailView";
import { Footer } from "@/components/layout/Footer";
import { Icon } from "@/components/ui/Icon";

type Props = { params: Promise<{ number: string }> };

async function load(number: string) {
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);
  try {
    return { report: await getReportDetail(decodeURIComponent(number), user, locale), t, locale };
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { report } = await load((await params).number);
  return { title: `${report.number} – ${report.title}`, description: report.description.slice(0, 160) };
}

export default async function ReportPage({ params }: Props) {
  const { report, t, locale } = await load((await params).number);
  return (
    <>
      <div className="bg-primary/5">
        <div className="container-page py-3">
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <Icon name="arrowLeft" size={16} /> {t("report.viewOnMap")}
          </Link>
        </div>
      </div>
      <div className="container-page py-6 sm:py-8">
        <ReportDetailView report={report} t={t} locale={locale} />
      </div>
      <Footer />
    </>
  );
}
