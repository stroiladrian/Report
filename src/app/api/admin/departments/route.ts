import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { assertCan } from "@/lib/rbac/policy";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { departmentSchema } from "@/lib/validation/schemas";
import { listDepartments, saveDepartment } from "@/server/services/admin";

export const GET = route(async () => {
  const u = await requireUser();
  assertCan(u, PERMISSIONS.REPORT_READ_ANY);
  return json({ items: await listDepartments() });
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const d = await saveDepartment(u, null, await readJson(req, departmentSchema));
  return json({ id: d.id }, { status: 201 });
});
