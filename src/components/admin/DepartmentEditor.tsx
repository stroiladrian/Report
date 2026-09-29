"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

type V = { id?: string; code: string; name: string; email: string; phone: string; isActive: boolean };

export function DepartmentEditor({ initial, mode }: { initial?: V; mode: "new" | "edit" }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const blank: V = { code: "", name: "", email: "", phone: "", isActive: true };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<V>(initial ?? blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  return (
    <>
      <Button size={mode === "edit" ? "sm" : "md"} variant={mode === "edit" ? "outline" : "primary"} icon={mode === "new" ? "plus" : undefined} onClick={() => { setV(initial ?? blank); setErr(null); setOpen(true); }}>
        {mode === "edit" ? t("common.edit") : t("admin.departments.new")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "edit" ? v.name : t("admin.departments.new")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                const json = { code: v.code, name: v.name, email: v.email, phone: v.phone || null, isActive: v.isActive };
                try {
                  if (v.id) await api(`/api/admin/departments/${v.id}`, { method: "PATCH", json });
                  else await api("/api/admin/departments", { json });
                  toast(t("admin.detail.saved"));
                  setOpen(false);
                  router.refresh();
                } catch (e) {
                  setErr(apiErrorState(e, t));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {err?.form && <Alert tone="error" className="sm:col-span-2">{err.form}</Alert>}
          <Field label={t("admin.departments.code")} required error={err?.fields.code} hint="A-Z, 0-9, _ -">{(p) => <Input {...p} value={v.code} onChange={set("code")} />}</Field>
          <Field label={t("admin.departments.name")} required error={err?.fields.name}>{(p) => <Input {...p} value={v.name} onChange={set("name")} />}</Field>
          <Field label={t("admin.departments.email")} error={err?.fields.email}>{(p) => <Input {...p} type="email" value={v.email} onChange={set("email")} />}</Field>
          <Field label={t("admin.departments.phone")}>{(p) => <Input {...p} value={v.phone} onChange={set("phone")} />}</Field>
          <Checkbox checked={v.isActive} onChange={set("isActive")} label={t("admin.users.active")} />
        </div>
      </Modal>
    </>
  );
}
