import { clientIp, json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { commentSchema } from "@/lib/validation/schemas";
import { addComment } from "@/server/services/reports";

/** POST /api/reports/:id/comments { body, kind: UPDATE|RESPONSE|NOTE|CITIZEN } */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireUser();
  rateLimit("write", actor.id);
  const input = await readJson(req, commentSchema);
  const c = await addComment(actor, params.id, input, { ip: clientIp(req) });
  return json({ id: c.id }, { status: 201 });
});
