import Link from "next/link";
import { branding } from "@config/branding";
import { tr } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";

export async function Footer() {
  const { t, locale } = await getT();
  return (
    <footer className="border-t border-slate-200 bg-slate-50 text-sm text-slate-700">
      <div className="container-page grid gap-6 py-8 sm:grid-cols-3">
        <div>
          <p className="font-bold text-slate-900">{tr(branding.organizationName, locale)}</p>
          <p className="mt-1">{tr(branding.contact.address, locale)}</p>
        </div>
        <div>
          <p className="font-bold text-slate-900">{t("footer.contact")}</p>
          <p className="mt-1">
            <a className="link" href={`tel:${branding.contact.phone.replace(/\s/g, "")}`}>{branding.contact.phone}</a>
          </p>
          <p>
            <a className="link" href={`mailto:${branding.contact.email}`}>{branding.contact.email}</a>
          </p>
        </div>
        <div className="sm:text-right">
          <p>
            <Link className="link" href={branding.legal.privacyUrl}>{t("footer.privacy")}</Link>
          </p>
          <p className="mt-1 text-slate-500">{t("footer.poweredBy", { brand: branding.brandName })}</p>
        </div>
      </div>
    </footer>
  );
}
