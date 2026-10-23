import Link from "next/link";
import { branding } from "@config/branding";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { tr } from "@/lib/i18n/core";
import { isStaff } from "@/lib/rbac/policy";
import { HeaderNav, HeaderShell, type HeaderUser } from "./HeaderNav";

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
    <HeaderShell>
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 z-50 rounded-full bg-primary px-4 py-2 font-semibold text-on-primary">
        {t("common.skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="group flex min-w-0 items-center gap-3 rounded-full pr-2" aria-label={`${branding.brandName} – ${t("common.home")}`}>
          {/* Brand orb: the logo on a soft gradient sphere (like the avatar in the reference design). */}
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_16px_-6px_rgb(var(--c-primary)/0.8)] [background:radial-gradient(circle_at_30%_25%,#e9e3ff,rgb(var(--c-primary))_45%,#5b6cf0_100%)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.logo.src} alt="" width={branding.logo.width} height={branding.logo.height} className="h-6 w-auto" />
          </span>
          <span className="min-w-0 text-[13px] font-semibold leading-tight text-foreground sm:text-sm">
            <span className="block truncate">{words.slice(0, half).join(" ")}</span>
            <span className="block truncate text-muted">{words.slice(half).join(" ")}</span>
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
    </HeaderShell>
  );
}
