import { z } from "zod";
import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/** POST { ids?: string[] } – mark given (or all) notifications as read. */
export const POST = route(async (req) => {
  const u = await requireUser();
  const { ids } = await readJson(req, z.object({ ids: z.array(z.string()).max(200).optional() }));
  await db.notification.updateMany({
    where: { userId: u.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return json({ ok: true });
});
