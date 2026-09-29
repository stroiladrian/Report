"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/client";
import type { NotificationDTO } from "@/types/reports";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icon";

export function NotificationsList({ items }: { items: NotificationDTO[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const unread = items.filter((n) => !n.readAt).length;
  const markRead = async (ids?: string[]) => {
    await api("/api/me/notifications/read", { json: ids ? { ids } : {} }).catch(() => undefined);
    router.refresh();
  };
  if (!items.length) return <EmptyState icon="bell" title={t("account.noNotifications")} />;
  return (
    <div className="space-y-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" icon="check" onClick={() => markRead()}>
            {t("account.markAllRead")}
          </Button>
        </div>
      )}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {items.map((n) => (
          <li key={n.id} className={cn("flex gap-3 p-4", !n.readAt && "bg-primary-light/30")}>
            <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {n.link ? (
                  <Link href={n.link} onClick={() => !n.readAt && markRead([n.id])} className="hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
                {!n.readAt && <span className="sr-only"> (new)</span>}
              </p>
              <p className="text-sm text-slate-700">{n.body}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <Icon name="clock" size={12} /> {formatDateTime(n.createdAt, locale)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
