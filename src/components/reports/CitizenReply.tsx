"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

/** Lets the reporter add information (e.g. when the city asks for clarification). */
export function CitizenReply({ reportId }: { reportId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return setErr(t("validation.required"));
        setBusy(true);
        setErr(null);
        try {
          await api(`/api/reports/${reportId}/comments`, { json: { body, kind: "CITIZEN" } });
          setBody("");
          toast(t("report.sent"));
          router.refresh();
        } catch (e) {
          setErr(t(`errors.${e instanceof ApiError ? e.code : "INTERNAL_ERROR"}` as never));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-2"
    >
      <Field label={t("report.addInfo")} error={err} counter={{ value: body.length, max: 4000 }}>
        {(p) => <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("report.addInfoPlaceholder")} maxLength={4000} className="min-h-24" />}
      </Field>
      <Button type="submit" loading={busy} icon="message">
        {t("report.send")}
      </Button>
    </form>
  );
}
