import { json, route } from "@/lib/http";
import { getLocale } from "@/lib/i18n/server";
import { loadWorkflow, statusDTO, statusGroups } from "@/server/services/workflow";

/** GET /api/statuses – statuses and public filter groups. */
export const GET = route(async () => {
  const locale = await getLocale();
  const { rows } = await loadWorkflow();
  return json({
    items: rows.filter((s) => s.isActive).map((s) => statusDTO(s, locale)),
    groups: await statusGroups(locale),
  });
});
