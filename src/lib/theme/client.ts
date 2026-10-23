"use client";

import { useSyncExternalStore } from "react";
import { branding } from "@config/branding";
import { mapStyleFor, THEME_COOKIE, type ThemeMode } from "./shared";

const EVENT = "cr:theme";

/** Current public-site theme, read from <html data-theme>. */
export function readTheme(): ThemeMode | null {
  if (typeof document === "undefined") return null;
  const el = document.documentElement;
  if (!el.classList.contains("cr-public")) return null;
  return el.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(mode: ThemeMode) {
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  document.documentElement.dataset.theme = mode;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Public theme (null in the back-office). Re-renders when the visitor switches. */
export function useTheme(): ThemeMode | null {
  return useSyncExternalStore(subscribe, readTheme, () => null);
}

/** Applies the area's <html> attributes after client-side navigation between the public site and the back-office. */
export function applyArea(area: "public" | "admin", mode: ThemeMode) {
  const el = document.documentElement;
  if (area === "public") {
    el.classList.add("cr-public");
    if (el.dataset.theme !== mode) el.dataset.theme = mode;
  } else {
    el.classList.remove("cr-public");
    delete el.dataset.theme;
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Map style for the current page: themed on the public site, the configured default in the back-office. */
export function currentMapStyle(): string {
  const mode = readTheme();
  return mode ? mapStyleFor(mode) : branding.map.styleUrl;
}
