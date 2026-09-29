import type { NextRequest } from "next/server";
import { json, route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { reportFiltersSchema } from "@/lib/validation/schemas";
import { reportFacets } from "@/server/services/reports";

/** GET /api/reports/facets – counts for the filter panel. */
export const GET = route(async (req: NextRequest) => {
  const filters = reportFiltersSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const [actor, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  return json(await reportFacets(filters, actor, locale));
});
