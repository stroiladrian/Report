import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmailVerification } from "@/server/services/auth";

export const POST = route(async () => {
  const u = await requireUser();
  rateLimit("passwordReset", `verify:${u.id}`);
  await sendEmailVerification(u.id);
  return json({ ok: true });
});
