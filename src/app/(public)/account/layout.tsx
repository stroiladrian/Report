import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { AccountNav } from "@/components/account/AccountNav";
import { ResendVerification } from "@/components/account/ResendVerification";
import { Alert } from "@/components/ui/States";
import { Footer } from "@/components/layout/Footer";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage("/account");
  const { t } = await getT();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <>
      <div className="container-page py-6 sm:py-8">
        <h1 className="mb-5 text-2xl font-extrabold tracking-tight sm:text-3xl">{t("account.title")}</h1>
        {user.email && !user.emailVerifiedAt && (
          <Alert tone="warning" className="mb-5 items-center">
            <span className="mr-2">{t("auth.unverifiedBanner")}</span>
            <ResendVerification />
          </Alert>
        )}
        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <AccountNav unread={unread} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
      <Footer />
    </>
  );
}
