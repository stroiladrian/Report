import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, requestMeta } from "@/lib/auth/session";
import { otpVerifySchema } from "@/lib/validation/schemas";
import { verifyPhoneOtp } from "@/server/services/auth";

export const POST = route(async (req) => {
  const { phone, code } = await readJson(req, otpVerifySchema);
  rateLimit("login", `${clientIp(req)}:${phone}`);
  const user = await verifyPhoneOtp(phone, code);
  await createSession(user.id, await requestMeta());
  return json({ ok: true });
});
