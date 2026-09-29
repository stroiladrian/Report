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

export type StatusRow = {
  id: string;
  key: string;
  label: { ro: string; en: string };
  pluralLabel: { ro: string; en: string };
  publicGroup: string;
  color: string;
  sortOrder: number;
  isInitial: boolean;
  isTerminal: boolean;
  isResolved: boolean;
  isActive: boolean;
  count: number;
};
type Tr = { fromStatusId: string; toStatusId: string; requiresComment: boolean };

export function TransitionMatrix({ statuses, transitions, canEdit }: { statuses: StatusRow[]; transitions: Tr[]; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const key = (a: string, b: string) => `${a}>${b}`;
  const [state, setState] = useState(() => new Map(transitions.map((x) => [key(x.fromStatusId, x.toStatusId), x.requiresComment])));
  const [busy, setBusy] = useState(false);
  const toggle = (a: string, b: string) =>
    setState((m) => {
      const n = new Map(m);
      const k = key(a, b);
      if (!n.has(k)) n.set(k, false);
      else if (n.get(k) === false) n.set(k, true); // allowed → allowed with note
      else n.delete(k);
      return n;
    });
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">{t("admin.workflow.help")}</p>
      <p className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-4 w-4 rounded bg-primary align-middle" /> ✓</span>
        <span><span className="mr-1 inline-block h-4 w-4 rounded bg-amber-500 align-middle" /> ✓ + {t("admin.workflow.requiresComment")}</span>
      </p>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th scope="col" className="p-1 text-left">{t("admin.workflow.from")} ↓ / {t("admin.workflow.to")} →</th>
              {statuses.map((s) => (
                <th key={s.id} scope="col" className="h-28 min-w-9 align-bottom">
                  <span className="inline-block -rotate-60 origin-bottom-left translate-x-4 whitespace-nowrap font-semibold">{s.label[locale]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statuses.map((from) => (
              <tr key={from.id}>
                <th scope="row" className="whitespace-nowrap p-1 pr-3 text-left font-semibold">
                  <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: from.color }} />
                  {from.label[locale]}
                </th>
                {statuses.map((to) => {
                  const k = key(from.id, to.id);
                  const on = state.has(k);
                  const note = state.get(k) === true;
                  if (from.id === to.id) return <td key={to.id} className="border border-slate-200 bg-slate-100" />;
                  return (
                    <td key={to.id} className="border border-slate-200 p-0 text-center">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggle(from.id, to.id)}
                        aria-label={`${from.label[locale]} → ${to.label[locale]}: ${on ? (note ? `✓ ${t("admin.workflow.requiresComment")}` : "✓") : "—"}`}
                        className={`h-9 w-9 font-bold ${on ? (note ? "bg-amber-500 text-white" : "bg-primary text-white") : "hover:bg-slate-100"}`}
                      >
                        {on ? "✓" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const list = [...state.entries()].map(([k, req]) => {
                const [fromStatusId, toStatusId] = k.split(">");
                return { fromStatusId: fromStatusId!, toStatusId: toStatusId!, requiresComment: req };
              });
              await api("/api/admin/workflow/transitions", { method: "PUT", json: { transitions: list } });
              toast(t("admin.detail.saved"));
              router.refresh();
            } catch (e) {
              toast(apiErrorState(e, t).form, "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {t("common.save")}
        </Button>
      )}
    </div>
  );
}

export function StatusEditor({ status, groups, mode }: { status?: StatusRow; groups: string[]; mode: "new" | "edit" }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const blank = {
    key: "", labelRo: "", labelEn: "", pluralRo: "", pluralEn: "", publicGroup: groups[0] ?? "submitted", color: "#64748b", sortOrder: "100",
    isInitial: false, isTerminal: false, isResolved: false, isActive: true,
  };
  const fromStatus = status
    ? {
        key: status.key, labelRo: status.label.ro, labelEn: status.label.en, pluralRo: status.pluralLabel.ro, pluralEn: status.pluralLabel.en,
        publicGroup: status.publicGroup, color: status.color, sortOrder: String(status.sortOrder), isInitial: status.isInitial, isTerminal: status.isTerminal,
        isResolved: status.isResolved, isActive: status.isActive,
      }
    : blank;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(fromStatus);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ReturnType<typeof apiErrorState> | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  return (
    <>
      <Button size="sm" variant={mode === "edit" ? "outline" : "primary"} icon={mode === "new" ? "plus" : undefined} onClick={() => { setV(fromStatus); setErr(null); setOpen(true); }}>
        {mode === "edit" ? t("common.edit") : t("admin.workflow.newStatus")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={mode === "edit" ? v.labelRo : t("admin.workflow.newStatus")}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                const json = {
                  key: v.key, label: { ro: v.labelRo, en: v.labelEn }, pluralLabel: { ro: v.pluralRo || v.labelRo, en: v.pluralEn || v.labelEn },
                  publicGroup: v.publicGroup, color: v.color, sortOrder: Number(v.sortOrder) || 0,
                  isInitial: v.isInitial, isTerminal: v.isTerminal, isResolved: v.isResolved, isActive: v.isActive,
                };
                try {
                  if (status) await api(`/api/admin/workflow/statuses/${status.id}`, { method: "PATCH", json });
                  else await api("/api/admin/workflow/statuses", { json });
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
          <Field label={t("admin.workflow.key")} required error={err?.fields.key} hint="a-z, 0-9, _">{(p) => <Input {...p} value={v.key} onChange={set("key")} disabled={mode === "edit"} />}</Field>
          <Field label={t("admin.workflow.group")} required hint={groups.join(", ")}>{(p) => <Input {...p} value={v.publicGroup} onChange={set("publicGroup")} list="groups" />}</Field>
          <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          <Field label={t("admin.workflow.labelRo")} required>{(p) => <Input {...p} value={v.labelRo} onChange={set("labelRo")} />}</Field>
          <Field label={t("admin.workflow.labelEn")} required>{(p) => <Input {...p} value={v.labelEn} onChange={set("labelEn")} />}</Field>
          <Field label={`${t("admin.workflow.labelRo")} (pl.)`}>{(p) => <Input {...p} value={v.pluralRo} onChange={set("pluralRo")} />}</Field>
          <Field label={`${t("admin.workflow.labelEn")} (pl.)`}>{(p) => <Input {...p} value={v.pluralEn} onChange={set("pluralEn")} />}</Field>
          <Field label={t("admin.categories.color")}>{(p) => <Input {...p} type="color" value={v.color} onChange={set("color")} className="h-11 p-1" />}</Field>
          <Field label={t("admin.categories.order")}>{(p) => <Input {...p} type="number" value={v.sortOrder} onChange={set("sortOrder")} />}</Field>
          <Checkbox checked={v.isInitial} onChange={set("isInitial")} label={t("admin.workflow.initial")} />
          <Checkbox checked={v.isTerminal} onChange={set("isTerminal")} label={t("admin.workflow.terminal")} />
          <Checkbox checked={v.isResolved} onChange={set("isResolved")} label={t("admin.workflow.resolvedFlag")} />
          <Checkbox checked={v.isActive} onChange={set("isActive")} label={t("admin.categories.active")} />
        </div>
      </Modal>
    </>
  );
}
