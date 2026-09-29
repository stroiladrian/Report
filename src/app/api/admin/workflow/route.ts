import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac/policy";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const GET = route(async () => {
  const u = await requireUser();
  assertCan(u, PERMISSIONS.REPORT_READ_ANY);
  const [statuses, transitions] = await Promise.all([
    db.reportStatus.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { reports: true } } } }),
    db.statusTransition.findMany(),
  ]);
  return json({ statuses, transitions });
});
