"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { appConfig } from "@config/app";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { GoogleButton } from "./GoogleButton";

function safeReturn(to: string | null) {
  return to && to.startsWith("/") && !to.startsWith("//") ? to : "/";
}

export function LoginForm({ returnTo, google = false, initialError = null }: { returnTo: string | null; google?: boolean; initialError?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ form: string; fields: Record<string, string> } | null>(initialError ? { form: initialError, fields: {} } : null);

  const done = () => {
    router.push(safeReturn(returnTo));
    router.refresh();
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(apiErrorState(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error?.form && <Alert tone="error">{error.form}</Alert>}
      {google && (
        <>
          <GoogleButton returnTo={returnTo} />
          <div className="flex items-center gap-3 text-sm text-slate-500" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" /> {t("auth.or").toUpperCase()} <span className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      )}
      {mode === "email" ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/auth/login", { json: { email, password } });
              done();
            });
          }}
          className="space-y-4"
        >
          <Field label={t("auth.email")} required error={error?.fields.email}>
            {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label={t("auth.password")} required error={error?.fields.password}>
            {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" fullWidth loading={busy}>
            {t("auth.login")}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link className="link" href="/forgot-password">
              {t("auth.forgot")}
            </Link>
            <Link className="link" href={`/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`}>
              {t("auth.noAccount")}
            </Link>
          </div>
        </form>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (!codeSent) {
                await api("/api/auth/otp/request", { json: { phone } });
                setCodeSent(true);
              } else {
                await api("/api/auth/otp/verify", { json: { phone, code } });
                done();
              }
            });
          }}
          className="space-y-4"
        >
          <Field label={t("auth.phone")} required error={error?.fields.phone}>
            {(p) => (
              <Input {...p} type="tel" inputMode="tel" autoComplete="tel" placeholder={t("auth.phonePlaceholder")} value={phone} disabled={codeSent} onChange={(e) => setPhone(e.target.value)} />
            )}
          </Field>
          {codeSent && (
            <>
              <Alert tone="info">{t("auth.codeSent", { len: appConfig.auth.otpLength, phone })}</Alert>
              <Field label={t("auth.code")} required error={error?.fields.code}>
                {(p) => (
                  <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tracking-[0.4em]" />
                )}
              </Field>
            </>
          )}
          <Button type="submit" fullWidth loading={busy}>
            {codeSent ? t("auth.verify") : t("auth.sendCode")}
          </Button>
          {codeSent && (
            <button type="button" className="link text-sm" onClick={() => { setCodeSent(false); setCode(""); }}>
              {t("common.back")}
            </button>
          )}
        </form>
      )}
      <div className="flex items-center gap-3 text-sm text-primary" aria-hidden="true">
        <span className="h-px flex-1 bg-primary/40" /> {t("auth.or").toUpperCase()} <span className="h-px flex-1 bg-primary/40" />
      </div>
      <Button
        variant="secondary"
        fullWidth
        icon={mode === "email" ? "phone" : "mail"}
        onClick={() => {
          setMode(mode === "email" ? "phone" : "email");
          setError(null);
        }}
      >
        {mode === "email" ? t("auth.withPhone") : t("auth.withEmail")}
      </Button>
    </div>
  );
}
