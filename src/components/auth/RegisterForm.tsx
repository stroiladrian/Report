"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { appConfig } from "@config/app";
import { branding } from "@config/branding";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-b border-slate-200 py-5 last:border-b-0 md:grid-cols-[13rem_1fr]">
      <legend className="contents">
        <span className="flex items-center gap-3 text-lg font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm text-white">{n}</span>
          {title}
        </span>
      </legend>
      <div className="grid gap-4 rounded-md border-t-4 border-primary bg-surface p-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function RegisterForm({ returnTo }: { returnTo: string | null }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirm: "", gdpr: false, truthful: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ form: string; fields: Record<string, string> } | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const f = err?.fields ?? {};

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (v.password !== v.confirm) return setErr({ form: "", fields: { confirm: t("validation.passwordMismatch") } });
        setBusy(true);
        setErr(null);
        try {
          await api("/api/auth/register", {
            json: { firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone, password: v.password, gdpr: v.gdpr, truthful: v.truthful, locale },
          });
          router.push(returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/account?welcome=1");
          router.refresh();
        } catch (e) {
          setErr(apiErrorState(e, t));
          window.scrollTo({ top: 0, behavior: "smooth" });
        } finally {
          setBusy(false);
        }
      }}
    >
      {err?.form && <Alert tone="error" className="mb-2">{err.form}</Alert>}
      <Section n={1} title={t("auth.sections.identity")}>
        <Field label={t("auth.firstName")} required error={f.firstName}>
          {(p) => <Input {...p} autoComplete="given-name" value={v.firstName} onChange={set("firstName")} maxLength={80} />}
        </Field>
        <Field label={t("auth.lastName")} required error={f.lastName}>
          {(p) => <Input {...p} autoComplete="family-name" value={v.lastName} onChange={set("lastName")} maxLength={80} />}
        </Field>
      </Section>
      <Section n={2} title={t("auth.sections.contact")}>
        <Field label={t("auth.email")} required error={f.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={v.email} onChange={set("email")} />}
        </Field>
        <Field label={<>{t("auth.phone")} <span className="font-normal text-slate-500">({t("common.optional")})</span></>} error={f.phone}>
          {(p) => <Input {...p} type="tel" autoComplete="tel" placeholder={t("auth.phonePlaceholder")} value={v.phone} onChange={set("phone")} />}
        </Field>
      </Section>
      <Section n={3} title={t("auth.sections.security")}>
        <Field label={t("auth.password")} required error={f.password} hint={t("auth.passwordHint", { min: appConfig.auth.passwordMinLength })}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={v.password} onChange={set("password")} />}
        </Field>
        <Field label={t("auth.confirmPassword")} required error={f.confirm}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={v.confirm} onChange={set("confirm")} />}
        </Field>
      </Section>
      <Section n={4} title={t("auth.sections.consent")}>
        <div className="space-y-3 sm:col-span-2">
          <Checkbox
            checked={v.gdpr}
            onChange={set("gdpr")}
            aria-invalid={!!f.gdpr || undefined}
            label={
              <>
                {t("auth.gdpr")}{" "}
                <Link className="link" href={branding.legal.privacyUrl} target="_blank">
                  ↗
                </Link>
              </>
            }
          />
          {f.gdpr && <p className="text-sm font-medium text-red-700">{f.gdpr}</p>}
          <Checkbox checked={v.truthful} onChange={set("truthful")} aria-invalid={!!f.truthful || undefined} label={t("auth.truthful")} />
          {f.truthful && <p className="text-sm font-medium text-red-700">{f.truthful}</p>}
        </div>
      </Section>
      <div className="flex flex-col items-center gap-3 pt-4 sm:flex-row sm:justify-between">
        <Link className="link text-sm" href={`/login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>
          {t("auth.haveAccount")}
        </Link>
        <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
          {t("auth.register")}
        </Button>
      </div>
    </form>
  );
}
