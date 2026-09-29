import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { destroySession } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** DELETE – log out from every device. */
export const DELETE = route(async () => {
  const u = await requireUser();
  await db.session.deleteMany({ where: { userId: u.id } });
  await destroySession();
  return json({ ok: true });
});
