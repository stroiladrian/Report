import type { NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, json, route } from "@/lib/http";
import { getLocale } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { getGeocoder } from "@/server/providers/geocoding";

const q = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) });

/** GET /api/geocode/reverse?lat=&lng= */
export const GET = route(async (req: NextRequest) => {
  rateLimit("geocode", clientIp(req));
  const { lat, lng } = q.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await getGeocoder().reverse(lat, lng, await getLocale()).catch(() => null);
  return json({ result });
});
