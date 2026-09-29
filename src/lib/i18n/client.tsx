"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { makeT, tr as trRaw, type Locale, type TFunction } from "./core";

type Ctx = { locale: Locale; t: TFunction; tr: (v: unknown) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: makeT(locale), tr: (v: unknown) => trRaw(v, locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useSetLocale() {
  return useCallback((locale: Locale) => {
    document.cookie = `cr_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    void fetch("/api/me/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale }),
    }).catch(() => undefined);
    window.location.reload();
  }, []);
}
