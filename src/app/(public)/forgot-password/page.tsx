import { getT } from "@/lib/i18n/server";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
import { ForgotForm } from "@/components/auth/PasswordForms";

export default async function ForgotPage() {
  const { t } = await getT();
  return (
    <AuthShell>
      <AuthCard title={t("auth.forgotTitle")}>
        <ForgotForm />
      </AuthCard>
    </AuthShell>
  );
}
