import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { categorySchema } from "@/lib/validation/schemas";
import { updateCategory } from "@/server/services/categories";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const u = await requireUser();
  await updateCategory(u, params.id, await readJson(req, categorySchema));
  return json({ ok: true });
});
