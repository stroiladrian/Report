import { getT } from "@/lib/i18n/server";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export default async function Forbidden() {
  const { t } = await getT();
  return (
    <div className="container-page py-16">
      <EmptyState icon="shield" title={t("errors.FORBIDDEN")} action={<ButtonLink href="/">{t("common.home")}</ButtonLink>} />
    </div>
  );
}
