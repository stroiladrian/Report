import type { NextRequest } from "next/server";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/server";
import { adminReportQuerySchema } from "@/lib/validation/schemas";
import { adminListReports } from "@/server/services/reports";
import { audit } from "@/server/services/audit";

const cell = (v: unknown) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // CSV/formula injection guard
  return `"${s.replace(/"/g, '""')}"`;
};

/** GET /api/admin/reports/export?… – CSV export of the filtered list (max 5000 rows). */
export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const q = adminReportQuerySchema.parse({ ...Object.fromEntries(req.nextUrl.searchParams), page: "1", pageSize: "200" });
  const locale = await getLocale();
  const rows: Awaited<ReturnType<typeof adminListReports>>["items"] = [];
  for (let page = 1; page <= 25; page++) {
    const res = await adminListReports(u, { ...q, page, pageSize: 200 }, locale);
    rows.push(...res.items);
    if (page >= res.pages) break;
  }
  await audit({ actorId: u.id, action: "report.export", entityType: "report", data: { rows: rows.length } });
  const header = ["number", "title", "status", "category", "department", "assignee", "address", "created", "due", "overdue", "public"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.number, r.title, r.status.label, r.category, r.department, r.assignee, r.address, r.createdAt, r.dueAt, r.overdue, r.isPublic].map(cell).join(","),
    ),
  );
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reports-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
});
