import type { NextRequest } from "next/server";
import { z } from "zod";
import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { adminUserCreateSchema } from "@/lib/validation/schemas";
import { createStaffUser, listUsers } from "@/server/services/admin";

export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const q = z
    .object({ q: z.string().max(100).optional(), role: z.string().optional(), page: z.coerce.number().int().min(1).default(1) })
    .parse(Object.fromEntries(req.nextUrl.searchParams));
  const res = await listUsers(u, { ...q, pageSize: 25 });
  return json({
    ...res,
    items: res.items.map((x) => ({
      id: x.id,
      name: `${x.firstName} ${x.lastName}`,
      email: x.email,
      phone: x.phone,
      role: x.role.key,
      isActive: x.isActive,
      department: x.employee?.isActive ? x.employee.department.name : null,
      reports: x._count.reports,
      createdAt: x.createdAt,
      lastLoginAt: x.lastLoginAt,
    })),
  });
});

export const POST = route(async (req) => {
  const u = await requireUser();
  const input = await readJson(req, adminUserCreateSchema);
  const user = await createStaffUser(u, input);
  return json({ id: user.id }, { status: 201 });
});
