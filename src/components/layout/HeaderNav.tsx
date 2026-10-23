"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dropdown } from "@heroui/react";
import { RouterProvider } from "react-aria-components";
import { appConfig } from "@config/app";
import { cn } from "@/lib/cn";
import { useI18n, useSetLocale } from "@/lib/i18n/client";
import { api } from "@/lib/api-client";
import { mapBus, useMapBus } from "@/lib/map-bus";
import { setTheme, useTheme } from "@/lib/theme/client";
import { Icon, type IconName } from "@/components/ui/Icon";

export type HeaderUser = { name: string; initials: string; staff: boolean; unread: number };
type NavLink = { label: string; href: string; external?: boolean; children?: { label: string; href: string; external?: boolean }[] };

/** True while the full-screen map is the page (also while a report dialog is open over it). */
function useOnMap() {
  const pathname = usePathname();
  const { explorer } = useMapBus();
  return pathname === "/" || explorer;
}

/** Header bar: floats transparently over the map on the home screen, solid (blurred) elsewhere. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const onMap = useOnMap();
  return (
    <header
      className={cn(
        "z-30 text-foreground",
        onMap
          ? "pointer-events-none absolute inset-x-0 top-0 bg-linear-to-b from-background via-background/70 to-transparent pb-6 *:pointer-events-auto"
          : "sticky top-0 border-b border-white/5 bg-background/80 backdrop-blur-xl [[data-theme=light]_&]:border-black/5",
      )}
    >
      {children}
    </header>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  href,
  badge,
  dot,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  href?: string;
  badge?: number;
  dot?: boolean;
}) {
  const cls =
    "relative grid h-11 w-11 place-items-center rounded-full text-foreground transition hover:bg-foreground/8 active:scale-95 focus-visible:outline-offset-0";
  const inner = (
    <>
      <Icon name={icon} size={24} strokeWidth={1.9} />
      {!!badge && (
        <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[11px] font-bold leading-[18px] text-on-primary tabular-nums">
          {badge}
        </span>
      )}
      {dot && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-500" aria-hidden="true" />}
    </>
  );
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {inner}
    </button>
  );
}

const itemCls = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-foreground outline-none data-[focused=true]:bg-foreground/8 data-[hovered=true]:bg-foreground/8 cursor-pointer";

export function HeaderNav({ user, links }: { user: HeaderUser | null; links: NavLink[] }) {
  const { t, locale } = useI18n();
  const setLocale = useSetLocale();
  const router = useRouter();
  const onMap = useOnMap();
  const { filterCount } = useMapBus();
  const theme = useTheme() ?? "dark";

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", json: {} }).catch(() => undefined);
    // Full reload so every server component forgets the session.
    window.location.assign("/");
  };

  type Item = { id: string; label: string; icon: IconName; href?: string; external?: boolean; danger?: boolean; badge?: number; action?: () => void };
  const accountItems: Item[] = user
    ? [
        { id: "account", label: t("header.account"), icon: "user", href: "/account" },
        { id: "reports", label: t("header.myReports"), icon: "bookmark", href: "/account/reports" },
        { id: "notifications", label: t("header.notifications"), icon: "bell", href: "/account/notifications", badge: user.unread },
        ...(user.staff ? [{ id: "admin", label: t("header.admin"), icon: "shield" as const, href: "/admin" }] : []),
      ]
    : [{ id: "login", label: t("header.login"), icon: "user", href: "/login" }];
  const linkItems: Item[] = links.flatMap((l) => (l.children?.length ? l.children : [l]).map((c) => ({ id: `link:${c.href}`, label: c.label, icon: "external" as const, href: c.href, external: c.external })));

  const renderItem = (i: Item) => (
    <Dropdown.Item
      key={i.id}
      id={i.id}
      textValue={i.label}
      href={i.href}
      target={i.external ? "_blank" : undefined}
      rel={i.external ? "noopener noreferrer" : undefined}
      onAction={i.action}
      className={cn(itemCls, i.danger && "text-red-400 [[data-theme=light]_&]:text-red-700")}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full cr-well">
        <Icon name={i.icon} size={17} />
      </span>
      <span className="min-w-0 flex-1 whitespace-nowrap">{i.label}</span>
      {!!i.badge && <span className="rounded-full bg-red-600 px-2 text-xs font-bold text-white">{i.badge}</span>}
    </Dropdown.Item>
  );

  const segment = (active: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition",
      active ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-foreground",
    );

  return (
    <nav className="ml-auto flex items-center gap-0.5" aria-label={t("common.menu")}>
      {onMap && <IconButton icon="search" label={t("map.searchFilters")} onClick={() => mapBus.emit("filters")} badge={filterCount} />}
      <IconButton icon="bookmark" label={t("header.myReports")} href={user ? "/account/reports" : "/login?returnTo=%2Faccount%2Freports"} />
      {onMap ? (
        <IconButton icon="pin" label={t("map.locateMe")} onClick={() => mapBus.emit("locate")} />
      ) : (
        <IconButton icon="map" label={t("header.home")} href="/" />
      )}

      <RouterProvider navigate={(href) => router.push(href)}>
        <Dropdown>
          <Dropdown.Trigger
            aria-label={user ? `${t("header.account")} – ${user.name}` : t("common.menu")}
            className="relative ml-1 grid h-10 w-10 place-items-center rounded-full outline-none transition active:scale-95 data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-primary"
          >
            {user ? (
              <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold uppercase text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] [background:radial-gradient(circle_at_30%_25%,#c9f3ff,#7aa7ff_45%,#7b5cf0_100%)]">
                {user.initials}
              </span>
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full cr-well">
                <Icon name="menu" size={20} />
              </span>
            )}
            {user && user.unread > 0 && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-background bg-red-500" aria-hidden="true" />}
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="w-[300px] rounded-3xl border border-white/8 bg-overlay p-2 shadow-overlay [[data-theme=light]_&]:border-black/5">
            {user && <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{user.name}</p>}
            <Dropdown.Menu aria-label={t("common.menu")} className="outline-none">
              {[
                ...accountItems.map(renderItem),
                ...linkItems.map(renderItem),
                ...(user ? [renderItem({ id: "logout", label: t("header.logout"), icon: "logout", danger: true, action: logout })] : []),
              ]}
            </Dropdown.Menu>
            {/* Appearance + language: segmented controls (kept outside the menu so they don't close it). */}
            <div className="mt-1 space-y-2 border-t border-foreground/8 px-1 pt-3 pb-1">
              <div role="group" aria-label={t("header.theme")} className="flex gap-1 rounded-full p-1 cr-well">
                <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={segment(theme === "dark")}>
                  <Icon name="moon" size={15} /> {t("header.themeDark")}
                </button>
                <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={segment(theme === "light")}>
                  <Icon name="sun" size={15} /> {t("header.themeLight")}
                </button>
              </div>
              <div role="group" aria-label={t("common.language")} className="flex gap-1 rounded-full p-1 cr-well">
                {appConfig.locales.map((l) => (
                  <button key={l} type="button" aria-pressed={l === locale} onClick={() => setLocale(l)} className={cn(segment(l === locale), "uppercase")}>
                    {l === appConfig.locales[0] && <Icon name="globe" size={15} />} {l}
                  </button>
                ))}
              </div>
            </div>
          </Dropdown.Popover>
        </Dropdown>
      </RouterProvider>
    </nav>
  );
}
