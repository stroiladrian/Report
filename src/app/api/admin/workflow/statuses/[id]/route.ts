import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { statusSchema } from "@/lib/validation/schemas";
import { saveStatus } from "@/server/services/admin";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  await saveStatus(u, params.id, await readJson(req, statusSchema));
  return json({ ok: true });
});
