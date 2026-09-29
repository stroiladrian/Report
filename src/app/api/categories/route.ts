import { json, route } from "@/lib/http";
import { getLocale } from "@/lib/i18n/server";
import { listCategories } from "@/server/services/categories";

/** GET /api/categories – active category tree (localized). */
export const GET = route(async () => json({ items: await listCategories(await getLocale()) }));
