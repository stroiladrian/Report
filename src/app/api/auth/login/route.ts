import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, requestMeta } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/schemas";
import { authenticate } from "@/server/services/auth";
import { audit } from "@/server/services/audit";

export const POST = route(async (req) => {
  const { email, password } = await readJson(req, loginSchema);
  rateLimit("login", `${clientIp(req)}:${email}`);
  const user = await authenticate(email, password);
  await createSession(user.id, await requestMeta());
  await audit({ actorId: user.id, action: "user.login", entityType: "user", entityId: user.id, ip: clientIp(req) });
  return json({ ok: true });
});
