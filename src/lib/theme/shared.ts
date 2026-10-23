import { branding } from "@config/branding";

export type ThemeMode = "dark" | "light";
export const THEME_COOKIE = "cr_theme";
/** Request header set by the middleware so the root layout knows which area (public / back-office) it renders. */
export const PATH_HEADER = "x-cr-path";

export const parseTheme = (v: string | undefined | null): ThemeMode =>
  v === "light" || v === "dark" ? v : branding.publicTheme.defaultMode;

export const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");

export const mapStyleFor = (mode: ThemeMode) => branding.publicTheme.mapStyle[mode];
