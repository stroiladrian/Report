import { describe, expect, it } from "vitest";
import {
  createReportSchema,
  normalizePhone,
  registerSchema,
  reportFiltersSchema,
  resolveDateRange,
} from "@/lib/validation/schemas";

describe("createReportSchema", () => {
  const base = { title: "Broken lamp", description: "The street lamp is broken since Monday.", categoryId: "c1" };

  it("accepts a valid report and trims text", () => {
    const r = createReportSchema.parse({ ...base, title: "  Broken lamp  " });
    expect(r.title).toBe("Broken lamp");
    expect(r.location).toBeUndefined();
  });

  it("enforces description min (13) and max (1024) length", () => {
    expect(createReportSchema.safeParse({ ...base, description: "too short" }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...base, description: "x".repeat(1025) }).success).toBe(false);
    expect(createReportSchema.safeParse({ ...base, description: "x".repeat(1024) }).success).toBe(true);
  });

  it("strips control characters before length checks", () => {
    const r = createReportSchema.safeParse({ ...base, description: "\u0000\u0001" + "a".repeat(5) });
    expect(r.success).toBe(false);
  });

  it("requires a category", () => {
    const r = createReportSchema.safeParse({ ...base, categoryId: "" });
    expect(r.success).toBe(false);
  });

  it("validates coordinates", () => {
    expect(createReportSchema.safeParse({ ...base, location: { lat: 91, lng: 0 } }).success).toBe(false);
    const ok = createReportSchema.parse({ ...base, location: { lat: 46.7, lng: 23.6, street: " Str. X ", streetNumber: "" } });
    expect(ok.location?.street).toBe("Str. X");
    expect(ok.location?.streetNumber).toBeNull();
    expect(ok.location?.source).toBe("map");
  });
});

describe("registerSchema", () => {
  const base = { firstName: "Ana", lastName: "Pop", email: "ANA@Example.com ", password: "long-enough-pw", gdpr: true, truthful: true };
  it("normalises e-mail and accepts optional phone", () => {
    const r = registerSchema.parse({ ...base, phone: "" });
    expect(r.email).toBe("ana@example.com");
    expect(r.phone).toBeNull();
  });
  it("requires both consents", () => {
    expect(registerSchema.safeParse({ ...base, gdpr: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, truthful: undefined }).success).toBe(false);
  });
  it("rejects short passwords", () => {
    expect(registerSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
  });
});

describe("phone normalisation", () => {
  it.each([
    ["0712 345 678", "+40712345678"],
    ["+40712345678", "+40712345678"],
    ["0040712345678", "+40712345678"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input.replace(/\s/g, ""))).toBe(out));
});

describe("report filters", () => {
  it("parses csv lists and defaults", () => {
    const f = reportFiltersSchema.parse({ status: "in_progress,resolved", category: "roads", period: "30d" });
    expect(f.status).toEqual(["in_progress", "resolved"]);
    expect(f.category).toEqual(["roads"]);
    expect(f.page).toBe(1);
    expect(f.sort).toBe("newest");
  });
  it("rejects unknown periods", () => {
    expect(reportFiltersSchema.safeParse({ period: "2y" }).success).toBe(false);
  });
  it("parses bbox", () => {
    expect(reportFiltersSchema.parse({ bbox: "1,2,3,4" }).bbox).toEqual([1, 2, 3, 4]);
    expect(reportFiltersSchema.parse({ bbox: "1,2,x" }).bbox).toBeNull();
  });
  it("resolves date ranges", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(resolveDateRange({ period: "7d" }, now).from?.toISOString()).toBe("2026-09-17T12:00:00.000Z");
    expect(resolveDateRange({ period: "all" }, now)).toEqual({ from: null, to: null });
    expect(resolveDateRange({ mine: true }, now).from?.getTime()).toBe(now.getTime() - 365 * 86_400_000);
    const custom = resolveDateRange({ from: "2026-01-01", to: "2026-01-31" }, now);
    expect(custom.from?.getDate()).toBe(1);
    expect(custom.to?.getDate()).toBe(31);
  });
});
