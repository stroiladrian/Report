"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { appConfig } from "@config/app";
import { cn } from "@/lib/cn";
import { useI18n, useSetLocale } from "@/lib/i18n/client";
import { api } from "@/lib/api-client";
import { Icon } from "@/components/ui/Icon";

export type HeaderUser = { name: string; initials: string; staff: boolean; unread: number };
type NavLink = { label: string; href: string; external?: boolean; children?: { label: string; href: string; external?: boolean }[] };

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onOut();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onOut();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref, onOut]);
}

function Dropdown({ label, children, align = "left", buttonClass, ariaLabel }: { label: React.ReactNode; children: React.ReactNode; align?: "left" | "right"; buttonClass?: string; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn("flex min-h-11 items-center gap-1 rounded-md px-3 font-semibold hover:bg-white/10", buttonClass)}
      >
        {label}
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 min-w-56 animate-pop-in overflow-hidden rounded-md bg-white py-1 text-slate-900 shadow-card ring-1 ring-slate-200",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={(e) => (e.target as HTMLElement).closest("a,button[data-close]") && setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

const itemCls = "flex w-full items-center gap-2 px-4 py-2.5 text-left text-[15px] hover:bg-slate-100";

export function HeaderNav({ user, links }: { user: HeaderUser | null; links: NavLink[] }) {
  const { t, locale } = useI18n();
  const setLocale = useSetLocale();
  const router = useRouter();

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", json: {} }).catch(() => undefined);
    // Full reload so every server component forgets the session.
    window.location.assign("/");
  };

  const langSwitch = (
    <div className="flex items-center gap-1 px-4 py-2" role="group" aria-label={t("common.language")}>
      <Icon name="globe" size={16} className="text-slate-500" />
      {appConfig.locales.map((l) => (
        <button
          key={l}
          type="button"
          data-close
          onClick={() => setLocale(l)}
          aria-pressed={l === locale}
          className={cn("rounded px-2 py-1 text-sm font-bold uppercase", l === locale ? "bg-primary text-white" : "text-slate-700 hover:bg-slate-100")}
        >
          {l}
        </button>
      ))}
    </div>
  );

  const accountItems = user ? (
    <>
      <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-500">{user.name}</div>
      <Link href="/account" className={itemCls}>
        <Icon name="user" size={18} /> {t("header.account")}
      </Link>
      <Link href="/account/reports" className={itemCls}>
        <Icon name="list" size={18} /> {t("header.myReports")}
      </Link>
      <Link href="/account/notifications" className={itemCls}>
        <Icon name="bell" size={18} /> {t("header.notifications")}
        {user.unread > 0 && <span className="ml-auto rounded-full bg-red-600 px-2 text-xs font-bold text-white">{user.unread}</span>}
      </Link>
      {user.staff && (
        <Link href="/admin" className={itemCls}>
          <Icon name="shield" size={18} /> {t("header.admin")}
        </Link>
      )}
      <button type="button" data-close onClick={logout} className={cn(itemCls, "border-t border-slate-100 text-red-700")}>
        <Icon name="logout" size={18} /> {t("header.logout")}
      </button>
    </>
  ) : (
    <Link href="/login" className={itemCls}>
      <Icon name="user" size={18} /> {t("header.login")}
    </Link>
  );

  return (
    <nav className="ml-auto flex items-center gap-1" aria-label={t("common.menu")}>
      {/* Desktop */}
      <div className="hidden items-center gap-1 lg:flex">
        {links.map((l) =>
          l.children?.length ? (
            <Dropdown key={l.label} label={<>{l.label} <Icon name="chevronDown" size={16} /></>}>
              {l.children.map((c) => (
                <a key={c.href} href={c.href} className={itemCls} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {c.label}
                  {c.external && <Icon name="external" size={14} className="ml-auto text-slate-400" />}
                </a>
              ))}
            </Dropdown>
          ) : (
            <a key={l.label} href={l.href} className="flex min-h-11 items-center rounded-md px-3 font-semibold hover:bg-white/10">
              {l.label}
            </a>
          ),
        )}
        {user ? (
          <Dropdown
            align="right"
            ariaLabel={t("header.account")}
            label={
              <>
                <span className="relative grid h-8 w-8 place-items-center rounded-full bg-white/20 text-sm font-bold uppercase">
                  {user.initials}
                  {user.unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-primary bg-red-500" />}
                </span>
                <span>{t("header.account")}</span>
                <Icon name="chevronDown" size={16} />
              </>
            }
          >
            {accountItems}
            <div className="border-t border-slate-100">{langSwitch}</div>
          </Dropdown>
        ) : (
          <>
            <Link href="/login" className="flex min-h-11 items-center rounded-md px-3 font-semibold hover:bg-white/10">
              {t("header.account")}
            </Link>
            <Dropdown align="right" ariaLabel={t("common.language")} label={<><Icon name="globe" size={18} /><span className="uppercase">{locale}</span></>}>
              {langSwitch}
            </Dropdown>
          </>
        )}
      </div>
      {/* Mobile / tablet */}
      <div className="flex items-center lg:hidden">
        <Dropdown
          align="right"
          buttonClass="relative h-11 w-11 justify-center !px-0"
          ariaLabel={t("common.menu")}
          label={
            <>
              <Icon name="menu" size={26} />
              {user && user.unread > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-red-500" aria-hidden="true" />
              )}
            </>
          }
        >
          {accountItems}
          {links.map((l) => (
            <div key={l.label} className="border-t border-slate-100">
              <p className="px-4 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{l.label}</p>
              {(l.children ?? [l]).map((c) => (
                <a key={c.href} href={c.href} className={itemCls} {...("external" in c && c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  {c.label}
                </a>
              ))}
            </div>
          ))}
          <div className="border-t border-slate-100">{langSwitch}</div>
        </Dropdown>
      </div>
    </nav>
  );
}
