import Link from "next/link";
import { branding } from "@config/branding";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n/core";
import { isStaff } from "@/lib/rbac/policy";
import { HeaderNav, type HeaderUser } from "./HeaderNav";

export async function Header() {
  const [{ t, locale }, user] = await Promise.all([getT(), getCurrentUser()]);
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const headerUser: HeaderUser | null = user
    ? { name: `${user.firstName} ${user.lastName}`, initials: `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`, staff: isStaff(user), unread }
    : null;
  const org = tr(branding.organizationName, locale);
  const words = org.split(" ");
  const half = Math.ceil(words.length / 2);
  return (
    <header className="relative z-30 bg-primary text-white">
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-white px-3 py-2 font-semibold text-primary">
        {t("common.skipToContent")}
      </a>
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${branding.brandName} – ${t("common.home")}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.logo.src} alt="" width={branding.logo.width} height={branding.logo.height} className="h-9 w-auto shrink-0 sm:h-10" />
          <span className="min-w-0 text-sm font-bold leading-tight sm:text-[15px]">
            <span className="block truncate">{words.slice(0, half).join(" ")}</span>
            <span className="block truncate">{words.slice(half).join(" ")}</span>
          </span>
        </Link>
        <HeaderNav
          user={headerUser}
          links={branding.headerLinks.map((l) => ({
            label: tr(l.label, locale),
            href: l.href,
            children: "children" in l ? l.children?.map((c) => ({ label: tr(c.label, locale), href: c.href, external: c.external })) : undefined,
          }))}
        />
      </div>
    </header>
  );
}
