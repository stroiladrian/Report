import { json, route } from "@/lib/http";
import { db } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { devMailboxEnabled } from "@/lib/dev";


/** GET /api/dev/mailbox – messages captured by the mock e-mail/SMS providers (development only). */
export const GET = route(async (req) => {
  if (!devMailboxEnabled()) throw Errors.notFound();
  const to = new URL(req.url).searchParams.get("to");
  const items = await db.notificationDelivery.findMany({
    where: to ? { recipient: to } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return json({ items });
});
