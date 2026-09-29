"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export function ProfileForm({ initial }: { initial: { firstName: string; lastName: string; phone: string; address: string } }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/me", { method: "PATCH", json: v });
          toast(t("account.profileSaved"));
          router.refresh();
        } catch (e) {
          setErr(apiErrorState(e, t));
        } finally {
          setBusy(false);
        }
      }}
    >
      {err?.form && <Alert tone="error" className="sm:col-span-2">{err.form}</Alert>}
      <Field label={t("auth.firstName")} required error={err?.fields.firstName}>
        {(p) => <Input {...p} value={v.firstName} onChange={set("firstName")} autoComplete="given-name" />}
      </Field>
      <Field label={t("auth.lastName")} required error={err?.fields.lastName}>
        {(p) => <Input {...p} value={v.lastName} onChange={set("lastName")} autoComplete="family-name" />}
      </Field>
      <Field label={t("auth.phone")} error={err?.fields.phone}>
        {(p) => <Input {...p} type="tel" value={v.phone} onChange={set("phone")} autoComplete="tel" />}
      </Field>
      <Field label={t("auth.address")} error={err?.fields.address}>
        {(p) => <Input {...p} value={v.address} onChange={set("address")} autoComplete="street-address" />}
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={busy}>
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
