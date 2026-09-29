import { requireUserPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { NotificationsList } from "@/components/account/NotificationsList";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUserPage("/account/notifications");
  const { t } = await getT();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t("account.notifications")}</h2>
      <NotificationsList
        items={items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))}
      />
    </div>
  );
}
