import { getT } from "@/lib/i18n/server";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
import { ResetForm } from "@/components/auth/PasswordForms";
import { Alert } from "@/components/ui/States";

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const { t } = await getT();
  return (
    <AuthShell>
      <AuthCard title={t("auth.resetTitle")}>{token ? <ResetForm token={token} /> : <Alert tone="error">{t("auth.verifyEmailFail")}</Alert>}</AuthCard>
    </AuthShell>
  );
}
