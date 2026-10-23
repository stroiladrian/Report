import { branding } from "@config/branding";

const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

type Mode = { [K in keyof typeof branding.publicTheme.dark]: string };

/** Public-site variables for one mode: our --c-* brand variables plus HeroUI's theme tokens. */
function publicVars(m: Mode) {
  return [
    `--c-primary:${rgb(m.primary)}`,
    `--c-primary-dark:${rgb(m.primaryDark)}`,
    `--c-primary-light:${rgb(m.primaryLight)}`,
    `--c-on-primary:${rgb(m.onPrimary)}`,
    // the "Report an issue" call-to-action uses the primary colour on the public site
    `--c-accent:${rgb(m.primary)}`,
    `--c-accent-dark:${rgb(m.primaryDark)}`,
    `--c-on-accent:${rgb(m.onPrimary)}`,
    `--c-surface:${rgb(m.surfaceSecondary)}`,
    // HeroUI tokens
    `--accent:${m.primary}`,
    `--accent-foreground:${m.onPrimary}`,
    `--focus:${m.primary}`,
    `--background:${m.background}`,
    `--foreground:${m.foreground}`,
    `--surface:${m.surface}`,
    `--surface-secondary:${m.surfaceSecondary}`,
    `--surface-tertiary:${m.surfaceTertiary}`,
    `--overlay:${m.surface}`,
    `--muted:${m.muted}`,
    `--border:${m.border}`,
    `--separator:${m.border}`,
    `--default:${m.surfaceSecondary}`,
    `--field-background:${m.surfaceSecondary}`,
  ].join(";");
}

/** CSS custom properties generated from config/branding.ts. */
export function brandCss() {
  const c = branding.colors;
  const p = branding.publicTheme;
  const admin = `:root{--c-primary:${rgb(c.primary)};--c-primary-dark:${rgb(c.primaryDark)};--c-primary-light:${rgb(c.primaryLight)};--c-on-primary:255 255 255;--c-secondary:${rgb(c.secondary)};--c-accent:${rgb(c.accent)};--c-accent-dark:${rgb(c.accentDark)};--c-on-accent:255 255 255;--c-danger:${rgb(c.danger)};--c-surface:${rgb(c.surface)};--brand-font:${branding.font.family};}`;
  const pub =
    `.cr-public{--radius:0.75rem;--brand-font:var(--font-inter),${branding.font.family};}` +
    `.cr-public,.cr-public[data-theme="light"]{color-scheme:light;${publicVars(p.light)}}` +
    `.cr-public[data-theme="dark"]{color-scheme:dark;${publicVars(p.dark)}}`;
  return admin + pub;
}
