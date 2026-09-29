import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { forgotSchema } from "@/lib/validation/schemas";
import { requestPasswordReset } from "@/server/services/auth";

export const POST = route(async (req) => {
  rateLimit("passwordReset", clientIp(req));
  const { email } = await readJson(req, forgotSchema);
  await requestPasswordReset(email);
  return json({ ok: true });
});
