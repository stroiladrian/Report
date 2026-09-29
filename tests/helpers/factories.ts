import { db } from "@/lib/db";
import { loadActor } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/crypto";

let n = 0;
export async function makeUser(roleKey: "CITIZEN" | "OPERATOR" | "ADMIN" | "SUPER_ADMIN", opts: { dept?: string; verified?: boolean } = {}) {
  n++;
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  const user = await db.user.create({
    data: {
      email: `t${Date.now()}-${n}@test.local`,
      firstName: "Test",
      lastName: `${roleKey}${n}`,
      roleId: role.id,
      passwordHash: await hashPassword("Password123!"),
      emailVerifiedAt: opts.verified === false ? null : new Date(),
    },
  });
  if (opts.dept) {
    const d = await db.department.findUniqueOrThrow({ where: { code: opts.dept } });
    await db.employee.create({ data: { userId: user.id, departmentId: d.id } });
  }
  return (await loadActor(user.id))!;
}

export async function category(slug: string) {
  return db.category.findUniqueOrThrow({ where: { slug }, include: { children: true } });
}

/** Minimal valid PNG (1×1). */
export const PNG_1PX = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc0000003010100c9fe92ef0000000049454e44ae426082",
  "hex",
);
