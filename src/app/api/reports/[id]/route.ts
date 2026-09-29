import type { NextRequest } from "next/server";
import { clientIp, json, readJson, route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/server";
import { isStaff } from "@/lib/rbac/policy";
import { rateLimit } from "@/lib/rate-limit";
import { updateReportSchema } from "@/lib/validation/schemas";
import { getAdminReportDetail, getReportDetail, updateReport } from "@/server/services/reports";

type P = { id: string };

/** GET /api/reports/:idOrNumber – public view, or staff view with ?view=admin */
export const GET = route<P>(async (req, { params }) => {
  const [actor, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (req.nextUrl.searchParams.get("view") === "admin" && actor && isStaff(actor)) {
    return json(await getAdminReportDetail(params.id, actor, locale));
  }
  return json(await getReportDetail(params.id, actor, locale));
});

/** PATCH /api/reports/:id – staff edits (assignment, category, location, visibility). */
export const PATCH = route<P>(async (req: NextRequest, { params }) => {
  const actor = await requireUser();
  rateLimit("write", actor.id);
  const patch = await readJson(req, updateReportSchema);
  await updateReport(actor, params.id, patch, { ip: clientIp(req) });
  return json(await getAdminReportDetail(params.id, actor, await getLocale()));
});
