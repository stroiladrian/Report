import type { NextRequest } from "next/server";
import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/server";
import { reportFiltersSchema } from "@/lib/validation/schemas";
import { listReports } from "@/server/services/reports";

/** GET /api/me/reports – the current user's reports (all periods by default). */
export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const filters = reportFiltersSchema.parse({ period: "all", ...params, mine: "1" });
  return json(await listReports(filters, u, await getLocale()));
});
