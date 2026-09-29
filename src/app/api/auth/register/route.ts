import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, requestMeta } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { registerSchema } from "@/lib/validation/schemas";
import { registerCitizen } from "@/server/services/auth";

export const POST = route(async (req) => {
  rateLimit("register", clientIp(req));
  const input = await readJson(req, registerSchema);
  const user = await registerCitizen({ ...input, locale: input.locale ?? (await getLocale()) }, { ip: clientIp(req) });
  await createSession(user.id, await requestMeta());
  return json({ id: user.id }, { status: 201 });
});
