"use client";

import { useLayoutEffect } from "react";
import { applyArea, readTheme } from "@/lib/theme/client";
import type { ThemeMode } from "@/lib/theme/shared";

/**
 * The root layout sets <html class="cr-public" data-theme> on the first request.
 * Layouts stay mounted during client-side navigation, so each area re-applies its own attributes here.
 */
export function ThemeScope({ area, initial }: { area: "public" | "admin"; initial: ThemeMode }) {
  useLayoutEffect(() => {
    applyArea(area, area === "public" ? (readTheme() ?? initial) : initial);
  }, [area, initial]);
  return null;
}
