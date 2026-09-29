import { clientIp, json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { Errors } from "@/lib/errors";
import { isMultipart, parseMultipart } from "@/lib/multipart";
import { addAttachments } from "@/server/services/reports";

/** POST /api/reports/:id/attachments – multipart files[] (+ isPublic=true for staff uploads) */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireUser();
  rateLimit("upload", actor.id);
  if (!isMultipart(req)) throw Errors.badRequest("Expected multipart/form-data");
  const { files, fields } = await parseMultipart(req);
  const rows = await addAttachments(actor, params.id, files, { isPublic: fields.get("isPublic") === "true" }, { ip: clientIp(req) });
  return json({ ids: rows.map((r) => r.id) }, { status: 201 });
});
