import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { adminUserUpdateSchema } from "@/lib/validation/schemas";
import { updateUser } from "@/server/services/admin";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  await updateUser(u, params.id, await readJson(req, adminUserUpdateSchema));
  return json({ ok: true });
});
