import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { departmentSchema } from "@/lib/validation/schemas";
import { saveDepartment } from "@/server/services/admin";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  await saveDepartment(u, params.id, await readJson(req, departmentSchema));
  return json({ ok: true });
});
