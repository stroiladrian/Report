import { branding } from "@config/branding";

const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** CSS custom properties generated from config/branding.ts. */
export function brandCss() {
  const c = branding.colors;
  return `:root{--c-primary:${rgb(c.primary)};--c-primary-dark:${rgb(c.primaryDark)};--c-primary-light:${rgb(c.primaryLight)};--c-secondary:${rgb(c.secondary)};--c-accent:${rgb(c.accent)};--c-accent-dark:${rgb(c.accentDark)};--c-danger:${rgb(c.danger)};--c-surface:${rgb(c.surface)};--font-sans:${branding.font.family};}`;
}
