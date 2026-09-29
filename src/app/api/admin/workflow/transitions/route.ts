import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { transitionsSchema } from "@/lib/validation/schemas";
import { replaceTransitions } from "@/server/services/admin";

/** PUT { transitions: [{ fromStatusId, toStatusId, requiresComment }] } – replaces the matrix. */
export const PUT = route(async (req) => {
  const u = await requireUser();
  const { transitions } = await readJson(req, transitionsSchema);
  await replaceTransitions(u, transitions);
  return json({ ok: true });
});
