import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Badge } from "@/components/ui/Badge";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const me = await requireUserPage("/account");
  const { t, locale } = await getT();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  const verified = (ok: boolean) => (
    <Badge className={ok ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}>{ok ? t("account.verified") : t("account.notVerified")}</Badge>
  );
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-xl font-bold">
          {user.firstName} {user.lastName}
        </h2>
        <p className="text-sm text-slate-500">{t("account.memberSince", { date: formatDate(user.createdAt, locale) })}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-slate-600">{t("auth.email")}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {user.email ?? "—"} {user.email && verified(!!user.emailVerifiedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-600">{t("auth.phone")}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {user.phone ?? "—"} {user.phone && verified(!!user.phoneVerifiedAt)}
            </dd>
          </div>
        </dl>
      </section>
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold">{t("account.profile")}</h2>
        <ProfileForm initial={{ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "", address: user.address ?? "" }} />
      </section>
    </div>
  );
}
