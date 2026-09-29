"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export type CategoryFormValue = {
  id?: string;
  slug: string;
  nameRo: string;
  nameEn: string;
  noticeRo: string;
  noticeEn: string;
  color: string;
  parentId: string;
  departmentId: string;
  slaDays: string;
  isSensitive: boolean;
  isActive: boolean;
  sortOrder: string;
};

export const emptyCategory: CategoryFormValue = {
  slug: "", nameRo: "", nameEn: "", noticeRo: "", noticeEn: "", color: "#64748b", parentId: "", departmentId: "", slaDays: "", isSensitive: false, isActive: true, sortOrder: "0",
};

export function CategoryEditor({
  initial,
  parents,
  departments,
  mode,
}: {
  initial: CategoryFormValue;
  parents: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  mode: "new" | "edit";
}) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  const set = (k: keyof CategoryFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  const save = async () => {
    setBusy(true);
    setErr(null);
    const json = {
      slug: v.slug,
      name: { ro: v.nameRo, en: v.nameEn },
      notice: v.noticeRo || v.noticeEn ? { ro: v.noticeRo, en: v.noticeEn } : null,
      color: v.color,
      parentId: v.parentId || null,
      departmentId: v.departmentId || null,
      slaDays: v.slaDays ? Number(v.slaDays) : null,
      isSensitive: v.isSensitive,
      isActive: v.isActive,
      sortOrder: Number(v.sortOrder) || 0,
    };
    try {
      if (v.id) await api(`/api/admin/categories/${v.id}`, { method: "PATCH", json });
      else await api("/api/admin/categories", { json });
      toast(t("admin.detail.saved"));
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(apiErrorState(e, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        size={mode === "edit" ? "sm" : "md"}
        variant={mode === "edit" ? "outline" : "primary"}
        icon={mode === "new" ? "plus" : undefined}
        onClick={() => {
          setV(initial);
          setErr(null);
          setOpen(true);
        }}
      >
        {mode === "edit" ? t("common.edit") : t("admin.categories.new")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={v.id ? v.nameRo || v.slug : t("admin.categories.new")}
        size="lg"
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button loading={busy} onClick={save}>{t("common.save")}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {err?.form && <Alert tone="error" className="sm:col-span-2">{err.form}</Alert>}
          <Field label={t("admin.categories.nameRo")} required error={err?.fields.name}>{(p) => <Input {...p} value={v.nameRo} onChange={set("nameRo")} />}</Field>
          <Field label={t("admin.categories.nameEn")} required>{(p) => <Input {...p} value={v.nameEn} onChange={set("nameEn")} />}</Field>
          <Field label={t("admin.categories.slug")} required error={err?.fields.slug} hint="a-z, 0-9, -">{(p) => <Input {...p} value={v.slug} onChange={set("slug")} />}</Field>
          <Field label={t("admin.categories.parent")}>
            {(p) => (
              <Select {...p} value={v.parentId} onChange={set("parentId")}>
                <option value="">{t("admin.categories.topLevel")}</option>
                {parents.filter((x) => x.id !== v.id).map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("admin.categories.department")}>
            {(p) => (
              <Select {...p} value={v.departmentId} onChange={set("departmentId")}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("admin.categories.sla")}>{(p) => <Input {...p} type="number" min={1} max={365} value={v.slaDays} onChange={set("slaDays")} />}</Field>
            <Field label={t("admin.categories.order")}>{(p) => <Input {...p} type="number" min={0} value={v.sortOrder} onChange={set("sortOrder")} />}</Field>
            <Field label={t("admin.categories.color")}>{(p) => <Input {...p} type="color" value={v.color} onChange={set("color")} className="h-11 p-1" />}</Field>
          </div>
          <Field label={t("admin.categories.noticeRo")} className="sm:col-span-2">{(p) => <Input {...p} value={v.noticeRo} onChange={set("noticeRo")} maxLength={500} />}</Field>
          <Field label={t("admin.categories.noticeEn")} className="sm:col-span-2">{(p) => <Input {...p} value={v.noticeEn} onChange={set("noticeEn")} maxLength={500} />}</Field>
          <Checkbox checked={v.isSensitive} onChange={set("isSensitive")} label={t("admin.categories.sensitive")} />
          <Checkbox checked={v.isActive} onChange={set("isActive")} label={t("admin.categories.active")} />
        </div>
      </Modal>
    </>
  );
}
