import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { assertCan } from "@/lib/rbac/policy";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { categorySchema } from "@/lib/validation/schemas";
import { adminListCategories, createCategory } from "@/server/services/categories";

export const GET = route(async () => {
  const u = await requireUser();
  assertCan(u, PERMISSIONS.REPORT_READ_ANY);
  return json({ items: await adminListCategories() });
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const c = await createCategory(u, await readJson(req, categorySchema));
  return json({ id: c.id }, { status: 201 });
});
