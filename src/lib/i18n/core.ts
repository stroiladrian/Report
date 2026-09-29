import en, { type Dictionary } from "./dictionaries/en";
import ro from "./dictionaries/ro";
import { appConfig, type Locale } from "@config/app";

export type { Dictionary, Locale };

export const dictionaries: Record<Locale, Dictionary> = { ro, en };

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly unknown[]
      ? never
      : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TKey = Leaves<Dictionary>;
export type TVars = Record<string, string | number>;
export type TFunction = (key: TKey, vars?: TVars) => string;

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (appConfig.locales as readonly string[]).includes(v);
}

export function interpolate(s: string, vars?: TVars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function lookup(dict: Dictionary, key: string): string {
  let cur: unknown = dict;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) cur = (cur as Record<string, unknown>)[part];
    else return key;
  }
  return typeof cur === "string" ? cur : key;
}

export function makeT(locale: Locale): TFunction {
  const dict = dictionaries[locale] ?? dictionaries[appConfig.defaultLocale];
  return (key, vars) => interpolate(lookup(dict, key), vars);
}

/** Resolve a localized DB/config value `{ ro, en }` (or plain string) for a locale. */
export function tr(value: unknown, locale: Locale): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const v = value as Record<string, string>;
    return v[locale] ?? v[appConfig.defaultLocale] ?? Object.values(v)[0] ?? "";
  }
  return String(value);
}

const intlLocale: Record<Locale, string> = { ro: "ro-RO", en: "en-GB" };

export function formatDate(d: Date | string | null | undefined, locale: Locale) {
  if (!d) return "";
  return new Intl.DateTimeFormat(intlLocale[locale], { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}
export function formatTime(d: Date | string, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale[locale], { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}
export function formatDateTime(d: Date | string | null | undefined, locale: Locale) {
  if (!d) return "";
  return `${formatDate(d, locale)} ${formatTime(d, locale)}`;
}
export function formatNumber(n: number, locale: Locale) {
  return new Intl.NumberFormat(intlLocale[locale]).format(n);
}
