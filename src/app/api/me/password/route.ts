import { clientIp, json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { changePassword } from "@/server/services/auth";

export const POST = route(async (req) => {
  const u = await requireUser();
  rateLimit("login", `pw:${u.id}:${clientIp(req)}`);
  const { currentPassword, newPassword } = await readJson(req, changePasswordSchema);
  await changePassword(u.id, currentPassword, newPassword);
  return json({ ok: true });
});
