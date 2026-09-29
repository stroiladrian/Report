import type { NextRequest } from "next/server";
import { clientIp, json, route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { Errors } from "@/lib/errors";
import { isMultipart, parseMultipart } from "@/lib/multipart";
import { createReportSchema, reportFiltersSchema } from "@/lib/validation/schemas";
import { createReport, listReports, mapReports } from "@/server/services/reports";

/** GET /api/reports?status=in_progress&category=roads&period=30d&format=map|list */
export const GET = route(async (req: NextRequest) => {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const filters = reportFiltersSchema.parse(params);
  const [actor, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (params.format === "map") {
    return json({ items: await mapReports(filters, actor, locale) });
  }
  return json(await listReports(filters, actor, locale));
});

/** POST /api/reports – multipart (data JSON + files[]) or application/json. */
export const POST = route(async (req: NextRequest) => {
  const actor = await getCurrentUser();
  if (!actor) throw Errors.unauthorized();
  rateLimit("createReport", actor.id);
  let data: unknown;
  let files: Awaited<ReturnType<typeof parseMultipart>>["files"] = [];
  if (isMultipart(req)) {
    ({ data, files } = await parseMultipart(req));
  } else {
    data = await req.json().catch(() => {
      throw Errors.badRequest("Invalid JSON");
    });
  }
  const input = createReportSchema.parse(data);
  const report = await createReport(actor, input, files, { ip: clientIp(req) });
  return json({ id: report.id, number: report.number }, { status: 201 });
});
