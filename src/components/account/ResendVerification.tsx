"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function ResendVerification() {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/auth/verify-email/resend", { json: {} });
          toast(t("auth.verificationSent"));
        } catch {
          toast(t("errors.INTERNAL_ERROR"), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("auth.resendVerification")}
    </Button>
  );
}
