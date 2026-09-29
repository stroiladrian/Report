import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { ChangePassword, LanguagePref, LogoutEverywhere, NotificationPrefs } from "@/components/account/SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireUserPage("/account/settings");
  const { t } = await getT();
  const u = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">{t("account.settings")}</h2>
      <section className="card space-y-4 p-5">
        <NotificationPrefs
          initial={{ firstName: u.firstName, lastName: u.lastName, notifyEmail: u.notifyEmail, notifySms: u.notifySms, notifyInApp: u.notifyInApp, hasPhone: !!u.phone }}
        />
      </section>
      <section className="card p-5">
        <LanguagePref />
      </section>
      <section className="card p-5">
        <h3 className="mb-3 font-semibold">{u.passwordHash ? t("account.changePassword") : t("auth.setPassword")}</h3>
        <ChangePassword hasPassword={!!u.passwordHash} />
      </section>
      <section className="card p-5">
        <LogoutEverywhere />
      </section>
    </div>
  );
}
