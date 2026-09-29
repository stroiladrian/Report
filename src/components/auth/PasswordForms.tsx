"use client";

import Link from "next/link";
import { useState } from "react";
import { appConfig } from "@config/app";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function ForgotForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  if (sent) return <Alert tone="success">{t("auth.forgotSent")}</Alert>;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/auth/password/forgot", { json: { email } });
          setSent(true);
        } catch (e) {
          setErr(apiErrorState(e, t));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-slate-700">{t("auth.forgotText")}</p>
      {err?.form && <Alert tone="error">{err.form}</Alert>}
      <Field label={t("auth.email")} required error={err?.fields.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" fullWidth loading={busy}>
        {t("auth.sendLink")}
      </Button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  if (done)
    return (
      <div className="space-y-4">
        <Alert tone="success">{t("auth.resetDone")}</Alert>
        <Link href="/login" className="link">
          {t("auth.login")}
        </Link>
      </div>
    );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/auth/password/reset", { json: { token, password: pw } });
          setDone(true);
        } catch (e) {
          setErr(apiErrorState(e, t));
        } finally {
          setBusy(false);
        }
      }}
    >
      {err?.form && <Alert tone="error">{err.form}</Alert>}
      <Field label={t("account.newPassword")} required error={err?.fields.password} hint={t("auth.passwordHint", { min: appConfig.auth.passwordMinLength })}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
      </Field>
      <Button type="submit" fullWidth loading={busy}>
        {t("common.save")}
      </Button>
    </form>
  );
}
