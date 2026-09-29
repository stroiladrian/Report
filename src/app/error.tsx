"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/client";
import { ErrorState } from "@/components/ui/States";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <main id="main" className="grid min-h-[60vh] place-items-center px-4">
      <ErrorState title={t("common.errorTitle")} text={t("common.errorText")} onRetry={reset} retryLabel={t("common.retry")} />
    </main>
  );
}
