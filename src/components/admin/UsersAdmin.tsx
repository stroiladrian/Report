"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type Role = { key: string; name: string };
type Dept = { id: string; name: string };
export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  departmentId: string | null;
  jobTitle: string | null;
};

export function UserRowActions({ user, roles, departments, canManage, isSelf }: { user: UserRow; roles: Role[]; departments: Dept[]; canManage: boolean; isSelf: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role);
  const [dept, setDept] = useState(user.departmentId ?? "");
  const [job, setJob] = useState(user.jobTitle ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!canManage) return null;
  const patch = async (json: object) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "PATCH", json });
      toast(t("admin.detail.saved"));
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(apiErrorState(e, t).form);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={isSelf}>
        {t("common.edit")}
      </Button>
      <Button
        size="sm"
        variant={user.isActive ? "ghost" : "secondary"}
        disabled={isSelf}
        onClick={async () => {
          if (user.isActive && !(await confirm({ title: t("admin.users.deactivate"), message: user.name, danger: true, confirmLabel: t("admin.users.deactivate") }))) return;
          await patch({ isActive: !user.isActive });
        }}
      >
        {user.isActive ? t("admin.users.deactivate") : t("admin.users.activate")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={user.name}
        size="sm"
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button loading={busy} onClick={() => patch({ roleKey: role, departmentId: dept || null, jobTitle: job || null })}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {err && <Alert tone="error">{err}</Alert>}
          <Field label={t("admin.users.role")}>
            {(p) => (
              <Select {...p} value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("admin.users.employee")}>
            {(p) => (
              <Select {...p} value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">— {t("admin.users.notEmployee")}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {dept && <Field label={t("admin.users.jobTitle")}>{(p) => <Input {...p} value={job} onChange={(e) => setJob(e.target.value)} />}</Field>}
        </div>
      </Modal>
    </div>
  );
}

export function CreateStaffUser({ roles, departments }: { roles: Role[]; departments: Dept[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", phone: "", roleKey: "OPERATOR", departmentId: "", jobTitle: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  return (
    <>
      <Button icon="plus" onClick={() => setOpen(true)}>
        {t("admin.users.create")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.users.create")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                try {
                  await api("/api/admin/users", { json: { ...v, departmentId: v.departmentId || null, jobTitle: v.jobTitle || null } });
                  toast(t("admin.users.created"));
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
          <Field label={t("auth.firstName")} required error={err?.fields.firstName}>{(p) => <Input {...p} value={v.firstName} onChange={set("firstName")} />}</Field>
          <Field label={t("auth.lastName")} required error={err?.fields.lastName}>{(p) => <Input {...p} value={v.lastName} onChange={set("lastName")} />}</Field>
          <Field label={t("auth.email")} required error={err?.fields.email}>{(p) => <Input {...p} type="email" value={v.email} onChange={set("email")} />}</Field>
          <Field label={t("auth.phone")} error={err?.fields.phone}>{(p) => <Input {...p} type="tel" value={v.phone} onChange={set("phone")} />}</Field>
          <Field label={t("admin.users.role")}>
            {(p) => (
              <Select {...p} value={v.roleKey} onChange={set("roleKey")}>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t("admin.users.employee")}>
            {(p) => (
              <Select {...p} value={v.departmentId} onChange={set("departmentId")}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
