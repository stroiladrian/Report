import { json, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { statusSchema } from "@/lib/validation/schemas";
import { saveStatus } from "@/server/services/admin";

export const POST = route(async (req) => {
  const u = await requireUser();
  const s = await saveStatus(u, null, await readJson(req, statusSchema));
  return json({ id: s.id }, { status: 201 });
});
