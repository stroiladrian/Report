import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { googleEnabled } from "@/server/services/google";

export const metadata = { title: "Register" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  if (await getCurrentUser()) redirect("/account");
  const { returnTo } = await searchParams;
  const { t } = await getT();
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-subtle px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("auth.registerTitle")}</h1>
        {googleEnabled() && (
          <div className="mb-4 rounded-lg bg-surface p-4 shadow-xs sm:p-6">
            <div className="mx-auto max-w-sm">
              <GoogleButton returnTo={returnTo ?? null} />
            </div>
          </div>
        )}
        <div className="rounded-lg bg-surface px-4 shadow-xs sm:px-6">
          <RegisterForm returnTo={returnTo ?? null} />
        </div>
      </div>
    </div>
  );
}
