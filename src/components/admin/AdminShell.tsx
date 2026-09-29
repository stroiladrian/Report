"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { branding } from "@config/branding";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import type { TKey } from "@/lib/i18n/core";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Drawer } from "@/components/ui/Modal";

export type AdminNavItem = { href: string; label: TKey; icon: IconName };

export function AdminShell({ nav, user, children }: { nav: AdminNavItem[]; user: { name: string; role: string }; children: React.ReactNode }) {
  const { t } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = (
    <ul className="space-y-0.5 p-2">
      {nav.map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold",
                active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon name={n.icon} size={18} />
              {t(n.label)}
            </Link>
          </li>
        );
      })}
      <li className="mt-4 border-t border-white/10 pt-3">
        <Link href="/" className="flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
          <Icon name="external" size={18} /> {t("admin.nav.publicSite")}
        </Link>
      </li>
    </ul>
  );
  return (
    <div className="min-h-dvh bg-slate-100 md:grid md:grid-cols-[15rem_1fr]">
      <a href="#admin-main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-white px-3 py-2 font-semibold text-primary">
        {t("common.skipToContent")}
      </a>
      <aside className="hidden bg-slate-900 md:block">
        <div className="sticky top-0">
          <Link href="/admin" className="flex h-16 items-center gap-2 bg-primary px-4 font-bold text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.logo.src} alt="" className="h-8 w-auto" />
            <span className="leading-tight">
              {branding.brandName}
              <span className="block text-xs font-medium opacity-80">{t("admin.title")}</span>
            </span>
          </Link>
          <nav aria-label={t("admin.title")}>{links}</nav>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 md:h-16 md:px-6">
          <button type="button" onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-md hover:bg-slate-100 md:hidden" aria-label={t("common.menu")}>
            <Icon name="menu" />
          </button>
          <span className="font-bold md:hidden">{t("admin.title")}</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-right leading-tight sm:block">
              <span className="block font-semibold">{user.name}</span>
              <span className="block text-xs text-slate-500">{user.role}</span>
            </span>
            <button
              type="button"
              onClick={async () => {
                await api("/api/auth/logout", { json: {} }).catch(() => undefined);
                // Full reload so every server component forgets the session.
                window.location.assign("/");
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-slate-300 px-3 font-semibold hover:bg-slate-50"
            >
              <Icon name="logout" size={16} /> <span className="hidden sm:inline">{t("header.logout")}</span>
            </button>
          </div>
        </header>
        <Drawer open={open} onClose={() => setOpen(false)} title={t("admin.title")} closeLabel={t("common.close")}>
          <nav className="h-full bg-slate-900">{links}</nav>
        </Drawer>
        <main id="admin-main" className="p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
