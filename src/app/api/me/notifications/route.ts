import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const GET = route(async () => {
  const u = await requireUser();
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.notification.count({ where: { userId: u.id, readAt: null } }),
  ]);
  return json({ items, unread });
});
