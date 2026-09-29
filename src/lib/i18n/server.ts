import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { appConfig } from "@config/app";
import { isLocale, makeT, type Locale } from "./core";

export const LOCALE_COOKIE = "cr_locale";

/** Locale resolution: cookie → Accept-Language → default. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return appConfig.defaultLocale;
});

export async function getT() {
  const locale = await getLocale();
  return { t: makeT(locale), locale };
}
