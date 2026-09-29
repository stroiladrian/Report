"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { appConfig } from "@config/app";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n, useSetLocale } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Prefs = { firstName: string; lastName: string; notifyEmail: boolean; notifySms: boolean; notifyInApp: boolean; hasPhone: boolean };

export function NotificationPrefs({ initial }: { initial: Prefs }) {
  const { t } = useI18n();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/me", { method: "PATCH", json: { firstName: v.firstName, lastName: v.lastName, notifyEmail: v.notifyEmail, notifySms: v.notifySms, notifyInApp: v.notifyInApp } });
          toast(t("admin.detail.saved"));
        } catch {
          toast(t("errors.INTERNAL_ERROR"), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">{t("account.notifPrefs")}</legend>
        <Checkbox checked={v.notifyInApp} onChange={(e) => setV({ ...v, notifyInApp: e.target.checked })} label={t("account.notifyInApp")} />
        <Checkbox checked={v.notifyEmail} onChange={(e) => setV({ ...v, notifyEmail: e.target.checked })} label={t("account.notifyEmail")} />
        <Checkbox checked={v.notifySms} disabled={!v.hasPhone} onChange={(e) => setV({ ...v, notifySms: e.target.checked })} label={t("account.notifySms")} />
      </fieldset>
      <Button type="submit" size="sm" loading={busy}>
        {t("common.save")}
      </Button>
    </form>
  );
}

export function LanguagePref() {
  const { t, locale } = useI18n();
  const setLocale = useSetLocale();
  return (
    <Field label={t("common.language")} className="max-w-xs">
      {(p) => (
        <Select {...p} value={locale} onChange={(e) => setLocale(e.target.value as (typeof appConfig.locales)[number])}>
          <option value="ro">Română</option>
          <option value="en">English</option>
        </Select>
      )}
    </Field>
  );
}

export function ChangePassword({ hasPassword = true }: { hasPassword?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  return (
    <form
      noValidate
      className="grid max-w-md gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await api("/api/me/password", { json: v });
          setV({ currentPassword: "", newPassword: "" });
          toast(t("account.passwordChanged"));
          if (!hasPassword) router.refresh();
        } catch (e) {
          setErr(apiErrorState(e, t));
        } finally {
          setBusy(false);
        }
      }}
    >
      {err?.form && <Alert tone="error">{err.form}</Alert>}
      {hasPassword ? (
        <Field label={t("account.currentPassword")} required error={err?.fields.currentPassword}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} />}
        </Field>
      ) : (
        <p className="text-sm text-slate-600">{t("auth.setPasswordHint")}</p>
      )}
      <Field label={t("account.newPassword")} required error={err?.fields.newPassword} hint={t("auth.passwordHint", { min: appConfig.auth.passwordMinLength })}>
        {(p) => <Input {...p} type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} />}
      </Field>
      <div>
        <Button type="submit" size="sm" loading={busy}>
          {hasPassword ? t("account.changePassword") : t("auth.setPassword")}
        </Button>
      </div>
    </form>
  );
}

export function LogoutEverywhere() {
  const { t } = useI18n();
  const router = useRouter();
  const confirm = useConfirm();
  return (
    <Button
      variant="danger"
      size="sm"
      icon="logout"
      onClick={async () => {
        if (!(await confirm({ title: t("account.sessions"), danger: true, confirmLabel: t("header.logout") }))) return;
        await api("/api/me/sessions", { method: "DELETE" }).catch(() => undefined);
        // Full reload so every server component forgets the session.
        window.location.assign("/");
      }}
    >
      {t("account.sessions")}
    </Button>
  );
}
