import { appConfig } from "@config/app";
import { requireUserPage } from "@/lib/auth/guards";
import { getT } from "@/lib/i18n/server";
import { listCategories } from "@/server/services/categories";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { ResendVerification } from "@/components/account/ResendVerification";
import { Alert } from "@/components/ui/States";

export const metadata = { title: "New report" };

export default async function SubmitPage() {
  const user = await requireUserPage("/submit");
  const { t, locale } = await getT();
  const categories = await listCategories(locale);
  const unverified = appConfig.reports.requireVerifiedContact && !user.emailVerifiedAt && !user.phoneVerifiedAt;
  return (
    <div className="container-page max-w-4xl py-6 sm:py-8">
      <h1 className="mb-5 text-2xl font-extrabold tracking-tight sm:text-3xl">{t("create.title")}</h1>
      {unverified && (
        <Alert tone="warning" className="mb-5 items-center">
          <span className="mr-2">{t("create.verifyRequired")}</span>
          <ResendVerification />
        </Alert>
      )}
      <ReportWizard categories={categories} />
    </div>
  );
}
