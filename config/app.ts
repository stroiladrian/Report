/**
 * Application behaviour settings (non-branding). Values that differ per
 * environment (secrets, URLs) live in environment variables – see .env.example.
 */
export const appConfig = {
  locales: ["ro", "en"] as const,
  defaultLocale: "ro" as "ro" | "en",

  reports: {
    titleMin: 5,
    titleMax: 120,
    descriptionMin: 13,
    descriptionMax: 1024,
    /** Default period shown on the public map (reference: last 30 days). */
    defaultPeriod: "30d" as const,
    /** Default period in "my reports" mode (reference: 1 year). */
    minePeriod: "365d" as const,
    /** Fallback SLA when a category has no slaDays configured. */
    defaultSlaDays: 30,
    /** Location is optional (a report "without location" is allowed, like the reference). */
    locationRequired: false,
    /** Require a verified e-mail or phone before a citizen can submit. */
    requireVerifiedContact: true,
    /** Max reports a single citizen can submit per hour (abuse protection). */
    maxPerHourPerUser: 10,
  },

  uploads: {
    maxFiles: 10,
    maxFileSizeMB: 25,
    /** MIME types accepted (content is sniffed server-side – extension alone is never trusted). */
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const,
  },

  auth: {
    sessionDays: 30,
    passwordMinLength: 10,
    otpLength: 6,
    otpTtlMinutes: 10,
    otpMaxAttempts: 5,
    resetTokenTtlMinutes: 60,
    verifyTokenTtlHours: 48,
  },

  pagination: {
    publicPageSize: 20,
    adminPageSize: 25,
  },
};

export type Locale = (typeof appConfig.locales)[number];
