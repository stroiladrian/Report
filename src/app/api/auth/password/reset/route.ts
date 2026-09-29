import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resetSchema } from "@/lib/validation/schemas";
import { resetPassword } from "@/server/services/auth";

export const POST = route(async (req) => {
  rateLimit("passwordReset", clientIp(req));
  const { token, password } = await readJson(req, resetSchema);
  await resetPassword(token, password);
  return json({ ok: true });
});
