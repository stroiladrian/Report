import type { Metadata, Viewport } from "next";
import { branding } from "@config/branding";
import { brandCss } from "@/lib/brand-css";
import { tr } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: { default: `${branding.brandName} – ${tr(branding.organizationName, locale)}`, template: `%s · ${branding.brandName}` },
    description: tr(branding.tagline, locale),
    icons: { icon: branding.favicon },
    // Stop iOS from turning numbers/dates into links (it changes the HTML before React hydrates).
    formatDetection: { telephone: false, date: false, email: false, address: false },
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    openGraph: { images: [branding.ogImage], siteName: branding.brandName },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: branding.colors.primary,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to <html>/<body> before React loads.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCss() }} />
        {branding.font.fontStylesheet && <link rel="stylesheet" href={branding.font.fontStylesheet} />}
      </head>
      <body suppressHydrationWarning>
        <I18nProvider locale={locale}>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
