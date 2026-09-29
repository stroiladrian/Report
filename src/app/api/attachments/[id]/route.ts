import { z } from "zod";
import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { setAttachmentVisibility } from "@/server/services/reports";

/** PATCH /api/attachments/:id { isPublic } – staff moderation of photos. */
export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireUser();
  const { isPublic } = await readJson(req, z.object({ isPublic: z.boolean() }));
  await setAttachmentVisibility(actor, params.id, isPublic);
  return json({ ok: true });
});
