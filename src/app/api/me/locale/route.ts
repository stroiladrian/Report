import { cookies } from "next/headers";
import { z } from "zod";
import { appConfig } from "@config/app";
import { json, readJson, route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const POST = route(async (req) => {
  const { locale } = await readJson(req, z.object({ locale: z.enum(appConfig.locales) }));
  (await cookies()).set("cr_locale", locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  const u = await getCurrentUser();
  if (u) await db.user.update({ where: { id: u.id }, data: { locale } });
  return json({ ok: true });
});
