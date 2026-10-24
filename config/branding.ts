/**
 * CENTRAL BRANDING CONFIGURATION
 * ------------------------------------------------------------------
 * Every piece of visual identity and organisation-specific information
 * used by Report lives in this file. Replace the values below to
 * re-brand the whole application (public site, admin, e-mails, SMS,
 * page titles, map defaults). See README → "Re-branding".
 *
 * Localised values use `{ ro, en }` objects; add more locales in
 * `src/lib/i18n/config.ts` and extend the objects here.
 */

export type Localized = { ro: string; en: string };

export type NavLink = {
  label: Localized;
  href: string;
  external?: boolean;
  children?: { label: Localized; href: string; external?: boolean }[];
};

export const branding = {
  /** Product name shown in the browser title, e-mails and the footer. */
  brandName: "Primăria Orașului Demo",

  /** Organisation running the platform (shown next to the logo, two lines on desktop). */
  organizationName: {
    ro: "Primăria Orașului Demo",
    en: "City Council Demo",
  } satisfies Localized,

  /** Short line used in <meta description>, footer and the login screen. */
  tagline: {
    ro: "Semnalează problemele din oraș și urmărește rezolvarea lor.",
    en: "Report problems in your city and follow their resolution.",
  } satisfies Localized,

  /**
   * Logo shown in the header. Put your file in /public/brand/ and point to it.
   * Recommended: SVG, light-coloured (it sits on the primary colour bar).
   */
  logo: {
    src: "/brand/logo.svg",
    alt: "Primăria Orașului Demo",
    width: 36,
    height: 40,
  },
  favicon: "/brand/favicon.svg",
  /** Image used for social sharing previews (1200×630). */
  ogImage: "/brand/og-image.svg",

  /** Colours – hex values. They are exposed as CSS variables and Tailwind colours. */
  colors: {
    primary: "#1f4fbf", // header bar, links, focus rings, dialog headers
    primaryDark: "#173b8f",
    primaryLight: "#dbe6ff",
    secondary: "#0f766e", // secondary accents
    accent: "#EA580C", // "Report an issue" call-to-action
    accentDark: "#C2410C",
    danger: "#dc2626",
    surface: "#f1f5f9",
  },

  /** CSS font-family stack. Optionally load a web font via `fontStylesheet`. */
  font: {
    family: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    /** e.g. "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" – null keeps system fonts */
    fontStylesheet: null as string | null,
  },

  contact: {
    email: "contact@demo-city.example",
    phone: "+40 000 000 000",
    address: {
      ro: "Piața Centrală nr. 1, Orașul Demo",
      en: "1 Central Square, Demo City",
    } satisfies Localized,
    website: "https://demo-city.example",
  },

  /** Header navigation (desktop row / mobile "Menu" dropdown). */
  // Empty = no extra menu items (only "My account", language and search are shown).
  // Example item: { label: { ro: "Servicii", en: "Services" }, href: "https://…", children: [ … ] }
  headerLinks: [] as NavLink[],

  /** Map defaults. Any MapLibre style URL works (no API key needed for OpenFreeMap). */
  map: {
    defaultLocation: { lat: 45.3893, lng: 21.224 }, // Deta, județul Timiș
    defaultZoom: 13,
    minZoom: 11,
    maxZoom: 19,
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    /** Optional [west, south, east, north] limits for panning & geocoder bias. */
    maxBounds: [21.1, 45.32, 21.35, 45.46] as [number, number, number, number] | null,
    attribution: "© OpenStreetMap contributors",
    /** Font stack for map labels – must exist on the style's glyph server. */
    labelFont: ["Noto Sans Bold"],
    /** Radius (km) around defaultLocation where the seed places demo reports. */
    demoRadiusKm: 1.4,
  },

  /** Prefix of generated report numbers, e.g. CR2026-000123. */
  reportNumberPrefix: "CR",

  /** Footer / legal links. */
  legal: {
    privacyUrl: "/privacy",
    termsUrl: "/privacy#terms",
  },
} as const;

export type Branding = typeof branding;
