import { json, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/server";
import { dashboardStats } from "@/server/services/admin";

export const GET = route(async () => json(await dashboardStats(await requireUser(), await getLocale())));
