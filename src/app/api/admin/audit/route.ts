import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { listAudit } from "@/server/services/admin";

export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const q = z
    .object({ entityType: z.string().max(40).optional(), action: z.string().max(60).optional(), page: z.coerce.number().int().min(1).default(1) })
    .parse(Object.fromEntries(req.nextUrl.searchParams));
  return json(await listAudit(u, { ...q, pageSize: 50 }));
});
