import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { ReportExplorer } from "@/components/map/ReportExplorer";
import { LoadingState } from "@/components/ui/States";

export default async function HomePage() {
  const [user, { t }] = await Promise.all([getCurrentUser(), getT()]);
  return (
    <>
      <h1 className="sr-only">{t("map.label")}</h1>
      <Suspense fallback={<LoadingState label={t("map.loading")} className="h-[70vh]" />}>
        <ReportExplorer loggedIn={!!user} />
      </Suspense>
    </>
  );
}
