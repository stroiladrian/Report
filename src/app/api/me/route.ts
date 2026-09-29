import { json, readJson, route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { profileSchema } from "@/lib/validation/schemas";
import { audit } from "@/server/services/audit";

function publicUser(u: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    phone: u.phone,
    emailVerified: !!u.emailVerifiedAt,
    phoneVerified: !!u.phoneVerifiedAt,
    locale: u.locale,
    role: u.roleKey,
    permissions: [...u.permissions],
  };
}

export const GET = route(async () => {
  const u = await getCurrentUser();
  return json({ user: u ? publicUser(u) : null });
});

export const PATCH = route(async (req) => {
  const u = await requireUser();
  const input = await readJson(req, profileSchema);
  if (input.phone && input.phone !== u.phone) {
    const taken = await db.user.findUnique({ where: { phone: input.phone } });
    if (taken && taken.id !== u.id) throw new AppError(409, "PHONE_TAKEN", "Phone already in use");
  }
  await db.user.update({
    where: { id: u.id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.phone !== undefined && input.phone !== u.phone ? { phone: input.phone, phoneVerifiedAt: null } : {}),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.notifyEmail !== undefined ? { notifyEmail: input.notifyEmail } : {}),
      ...(input.notifySms !== undefined ? { notifySms: input.notifySms } : {}),
      ...(input.notifyInApp !== undefined ? { notifyInApp: input.notifyInApp } : {}),
    },
  });
  await audit({ actorId: u.id, action: "user.profile_update", entityType: "user", entityId: u.id });
  return json({ ok: true });
});
