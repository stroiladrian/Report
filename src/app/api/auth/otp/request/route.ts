import { clientIp, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { getLocale } from "@/lib/i18n/server";
import { otpRequestSchema } from "@/lib/validation/schemas";
import { requestPhoneOtp } from "@/server/services/auth";

/** Always answers 200 so the endpoint cannot be used to discover registered numbers. */
export const POST = route(async (req) => {
  const { phone } = await readJson(req, otpRequestSchema);
  rateLimit("otp", `${clientIp(req)}`);
  rateLimit("otp", `phone:${phone}`);
  await requestPhoneOtp(phone, await getLocale());
  return json({ ok: true });
});
