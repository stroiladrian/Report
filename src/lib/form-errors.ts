import type { TFunction } from "./i18n/core";
import { ApiError } from "./api-client";

/** Translate a validation message code from the API ("min:10", "email", "consent", …). */
export function fieldMessage(code: string | undefined, t: TFunction): string {
  if (!code) return "";
  const [k, arg] = code.split(":");
  switch (k) {
    case "min":
      return t("validation.min", { min: arg ?? "" });
    case "max":
      return t("validation.max", { max: arg ?? "" });
    case "email":
      return t("validation.email");
    case "phone":
      return t("validation.phone");
    case "consent":
      return t("validation.consent");
    case "category":
      return t("validation.category");
    case "subcategory":
      return t("validation.subcategory");
    case "location":
      return t("validation.location");
    case "required":
      return t("validation.required");
    default:
      return code.includes(" ") ? code : t("validation.required");
  }
}

export function apiErrorState(e: unknown, t: TFunction): { form: string; fields: Record<string, string> } {
  if (!(e instanceof ApiError)) return { form: t("errors.INTERNAL_ERROR"), fields: {} };
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(e.details?.fieldErrors ?? {})) fields[k] = fieldMessage(v?.[0], t);
  const known = t(`errors.${e.code}` as never);
  return { form: known.startsWith("errors.") ? e.message : known, fields };
}
