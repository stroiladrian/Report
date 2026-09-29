import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { verifyEmail } from "@/server/services/auth";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
import { Alert } from "@/components/ui/States";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { t } = await getT();
  const ok = token ? !!(await verifyEmail(token)) : false;
  return (
    <AuthShell>
      <AuthCard title={t("auth.verifyEmailTitle")}>
        <Alert tone={ok ? "success" : "error"}>{ok ? t("auth.verifyEmailOk") : t("auth.verifyEmailFail")}</Alert>
        <div className="mt-4 flex gap-4">
          <Link href="/submit" className="link">
            {t("header.reportIssue")}
          </Link>
          <Link href="/account" className="link">
            {t("header.account")}
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
