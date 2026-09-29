import { json, route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/rbac/policy";
import { db } from "@/lib/db";

/** GET /api/departments – public: names only; staff: with active operators. */
export const GET = route(async () => {
  const actor = await getCurrentUser();
  const staff = isStaff(actor);
  const rows = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: staff ? { employees: { where: { isActive: true }, include: { user: true } } } : undefined,
  });
  return json({
    items: rows.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      ...(staff && "employees" in d
        ? {
            employees: (d.employees as { id: string; user: { firstName: string; lastName: string } }[]).map((e) => ({
              id: e.id,
              name: `${e.user.firstName} ${e.user.lastName}`,
            })),
          }
        : {}),
    })),
  });
});
