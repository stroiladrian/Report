import { z } from "zod";
import { appConfig } from "@config/app";

const R = appConfig.reports;
const A = appConfig.auth;

/** Trim + collapse control characters; used for all free-text input. */
const text = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(min, { message: `min:${min}` }).max(max, { message: `max:${max}` }));

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.trim() || null)
    .nullish();

export const emailSchema = z.string().trim().toLowerCase().email({ message: "email" }).max(254);

/** Accepts local (07xx…) and international (+40…) formats; normalised to E.164-like "+…" digits. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s().-]/g, ""))
  .refine((s) => /^(\+?\d{9,15})$/.test(s), { message: "phone" })
  .transform((s) => normalizePhone(s));

export function normalizePhone(s: string): string {
  const digits = s.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+40${digits.slice(1)}`; // default country prefix – adjust for your country
  return `+${digits}`;
}

export const passwordSchema = z
  .string()
  .min(A.passwordMinLength, { message: `min:${A.passwordMinLength}` })
  .max(200);

// ─── Auth ──────────────────────────────────────────────────────────

export const registerSchema = z.object({
  firstName: text(1, 80),
  lastName: text(1, 80),
  email: emailSchema,
  phone: z
    .union([phoneSchema, z.literal("")])
    .optional()
    .transform((v) => v || null),
  password: passwordSchema,
  gdpr: z.literal(true, { errorMap: () => ({ message: "consent" }) }),
  truthful: z.literal(true, { errorMap: () => ({ message: "consent" }) }),
  locale: z.enum(appConfig.locales).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const otpRequestSchema = z.object({ phone: phoneSchema });
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{4,8}$/, { message: "code" }),
});
export const forgotSchema = z.object({ email: emailSchema });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

export const profileSchema = z.object({
  firstName: text(1, 80),
  lastName: text(1, 80),
  /** undefined = unchanged, "" = remove */
  phone: z
    .union([phoneSchema, z.literal("")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null)),
  address: z
    .string()
    .max(200)
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim() || null)),
  locale: z.enum(appConfig.locales).optional(),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  // Empty only for accounts created with Google that have no password yet.
  currentPassword: z.string().max(200).default(""),
  newPassword: passwordSchema,
});

// ─── Reports ───────────────────────────────────────────────────────

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  street: optionalText(160),
  streetNumber: optionalText(20),
  district: optionalText(120),
  formattedAddress: optionalText(300),
  source: z.enum(["map", "gps", "search", "admin"]).default("map"),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const createReportSchema = z
  .object({
    title: text(R.titleMin, R.titleMax),
    description: text(R.descriptionMin, R.descriptionMax),
    categoryId: z.string().min(1, { message: "category" }),
    subcategoryId: z.string().min(1).nullish(),
    location: locationSchema.nullish(),
  })
  .superRefine((v, ctx) => {
    if (R.locationRequired && !v.location) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["location"], message: "location" });
    }
  });
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const PERIODS = ["7d", "30d", "90d", "365d", "all"] as const;
export type Period = (typeof PERIODS)[number];

const csv = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []));

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

/** Public filter model – mirrors the query string (?status=…&category=…&period=30d). */
export const reportFiltersSchema = z.object({
  status: csv, // public group keys
  category: csv, // top-level category slugs
  period: z.enum(PERIODS).optional(),
  from: isoDate,
  to: isoDate,
  q: z.string().trim().max(100).optional(),
  bbox: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return null;
      const n = s.split(",").map(Number);
      return n.length === 4 && n.every(Number.isFinite) ? (n as [number, number, number, number]) : null;
    }),
  mine: z
    .string()
    .optional()
    .transform((s) => s === "1" || s === "true"),
  sort: z.enum(["newest", "oldest", "updated"]).default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(appConfig.pagination.publicPageSize),
});
export type ReportFilters = z.infer<typeof reportFiltersSchema>;

/** Resolve period/from/to into a concrete date range. */
export function resolveDateRange(
  f: Partial<Pick<ReportFilters, "period" | "from" | "to" | "mine">>,
  now = new Date(),
): { from: Date | null; to: Date | null } {
  if (f.from || f.to) {
    return {
      from: f.from ? new Date(`${f.from}T00:00:00`) : null,
      to: f.to ? new Date(`${f.to}T23:59:59.999`) : null,
    };
  }
  const period = f.period ?? (f.mine ? appConfig.reports.minePeriod : appConfig.reports.defaultPeriod);
  if (period === "all") return { from: null, to: null };
  const days = Number(period.replace("d", ""));
  return { from: new Date(now.getTime() - days * 86_400_000), to: null };
}

export const statusChangeSchema = z.object({
  status: z.string().min(1).max(50),
  note: optionalText(2000),
  isPublic: z.boolean().default(true),
  redirectedTo: optionalText(200),
  resolution: optionalText(2000),
});

export const commentSchema = z.object({
  body: text(1, 4000),
  kind: z.enum(["UPDATE", "RESPONSE", "NOTE", "CITIZEN"]).default("UPDATE"),
});

export const updateReportSchema = z.object({
  title: text(R.titleMin, R.titleMax).optional(),
  categoryId: z.string().min(1).optional(),
  subcategoryId: z.string().min(1).nullable().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  isPublic: z.boolean().optional(),
  dueAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
    .optional(),
  location: locationSchema.nullable().optional(),
});

export const adminReportQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: csv, // status keys
  category: z.string().optional(),
  department: z.string().optional(),
  assignee: z.string().optional(), // employee id | "me" | "none"
  overdue: z
    .string()
    .optional()
    .transform((s) => s === "1"),
  sort: z.enum(["newest", "oldest", "updated", "due"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(appConfig.pagination.adminPageSize),
});

// ─── Admin config ──────────────────────────────────────────────────

const localized = (max: number, required = true) =>
  z.object({ ro: required ? text(1, max) : z.string().max(max), en: required ? text(1, max) : z.string().max(max) });

export const categorySchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}$/, { message: "slug" }),
  name: localized(120),
  notice: z.object({ ro: z.string().max(500), en: z.string().max(500) }).nullish(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  parentId: z.string().min(1).nullish(),
  departmentId: z.string().min(1).nullish(),
  slaDays: z.coerce.number().int().min(1).max(365).nullish(),
  isSensitive: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const departmentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,20}$/, { message: "code" }),
  name: text(2, 120),
  email: z.union([emailSchema, z.literal("")]).optional().transform((v) => v || null),
  phone: optionalText(40),
  isActive: z.boolean().default(true),
});

export const statusSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/),
  label: localized(60),
  pluralLabel: localized(60),
  publicGroup: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isInitial: z.boolean().default(false),
  isTerminal: z.boolean().default(false),
  isResolved: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const transitionsSchema = z.object({
  transitions: z
    .array(
      z.object({
        fromStatusId: z.string().min(1),
        toStatusId: z.string().min(1),
        requiresComment: z.boolean().default(false),
      }),
    )
    .max(500),
});

export const adminUserUpdateSchema = z.object({
  roleKey: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  jobTitle: optionalText(120),
});

export const adminUserCreateSchema = z.object({
  firstName: text(1, 80),
  lastName: text(1, 80),
  email: emailSchema,
  phone: z
    .union([phoneSchema, z.literal("")])
    .optional()
    .transform((v) => v || null),
  roleKey: z.string().min(1),
  departmentId: z.string().min(1).nullish(),
  jobTitle: optionalText(120),
});
