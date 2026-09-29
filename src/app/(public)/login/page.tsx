import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { dictionaries } from "@/lib/i18n/core";
import { AuthCard, AuthShell } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { Icon } from "@/components/ui/Icon";
import { googleEnabled } from "@/server/services/google";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; error?: string }> }) {
  const { returnTo, error } = await searchParams;
  if (await getCurrentUser()) redirect(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account");
  const { t, locale } = await getT();
  const googleErrors = dictionaries[locale].auth.googleErrors as Record<string, string>;
  const initialError = error ? (googleErrors[error] ?? googleErrors.google!) : null;
  return (
    <AuthShell>
      <AuthCard title={t("auth.loginTitle")}>
        {returnTo?.startsWith("/submit") && <p className="mb-4 rounded bg-primary-light/60 px-3 py-2 text-sm text-primary-dark">{t("create.loginRequired")}</p>}
        <LoginForm returnTo={returnTo ?? null} google={googleEnabled()} initialError={initialError} />
      </AuthCard>
      <Faq />
    </AuthShell>
  );
}

async function Faq() {
  const { t, locale } = await getT();
  const items = dictionaries[locale].auth.faq;
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm sm:p-6" aria-labelledby="faq-h">
      <h2 id="faq-h" className="mb-3 flex items-center gap-2 text-xl font-bold">
        <Icon name="info" /> {t("auth.faqTitle")}
      </h2>
      <div className="divide-y divide-slate-200 border-t border-slate-200">
        {items.map((f) => (
          <details key={f.q} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
              {f.q}
              <Icon name="chevronDown" size={18} className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm text-slate-700">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
