"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { Icon, type IconName } from "@/components/ui/Icon";

export function AccountNav({ unread }: { unread: number }) {
  const { t } = useI18n();
  const path = usePathname();
  const items: { href: string; label: string; icon: IconName; badge?: number }[] = [
    { href: "/account", label: t("account.profile"), icon: "user" },
    { href: "/account/reports", label: t("account.reports"), icon: "list" },
    { href: "/account/notifications", label: t("account.notifications"), icon: "bell", badge: unread },
    { href: "/account/settings", label: t("account.settings"), icon: "shield" },
  ];
  return (
    <nav aria-label={t("account.title")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {items.map((i) => {
          const active = i.href === "/account" ? path === "/account" : path.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 font-semibold",
                  active ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <Icon name={i.icon} size={18} />
                {i.label}
                {!!i.badge && <span className={cn("ml-auto rounded-full px-2 text-xs", active ? "bg-white text-primary" : "bg-red-600 text-white")}>{i.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
