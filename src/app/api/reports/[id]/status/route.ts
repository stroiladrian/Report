import { clientIp, json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { statusChangeSchema } from "@/lib/validation/schemas";
import { changeStatus, getAdminReportDetail } from "@/server/services/reports";

/** POST /api/reports/:id/status { status, note?, isPublic?, redirectedTo?, resolution? } */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireUser();
  rateLimit("write", actor.id);
  const input = await readJson(req, statusChangeSchema);
  await changeStatus(actor, params.id, input, { ip: clientIp(req) });
  return json(await getAdminReportDetail(params.id, actor, await getLocale()));
});
