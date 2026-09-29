import type { NextRequest } from "next/server";
import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/server";
import { adminReportQuerySchema } from "@/lib/validation/schemas";
import { adminListReports } from "@/server/services/reports";

export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const q = adminReportQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return json(await adminListReports(u, q, await getLocale()));
});
