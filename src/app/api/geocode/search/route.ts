import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, json, route } from "@/lib/http";
import { getLocale } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { getGeocoder } from "@/server/providers/geocoding";

/** GET /api/geocode/search?q= – address autocomplete (biased to the service area). */
export const GET = route(async (req: NextRequest) => {
  rateLimit("geocode", clientIp(req));
  const { q } = z.object({ q: z.string().trim().min(3).max(120) }).parse(Object.fromEntries(req.nextUrl.searchParams));
  const items = await getGeocoder().search(q, await getLocale()).catch(() => []);
  return json({ items });
});
