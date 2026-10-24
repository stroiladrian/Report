"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { apiErrorState } from "@/lib/form-errors";
import { formatDateTime } from "@/lib/i18n/core";
import { useI18n } from "@/lib/i18n/client";
import type { AdminReportDetailDTO, CategoryDTO } from "@/types/reports";
import { Alert } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { LocationPicker, type PickedLocation } from "@/components/map/LocationPicker";

type Dept = { id: string; name: string; employees: { id: string; name: string }[] };

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200", className)}>
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function useAction() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, okMsg = t("admin.detail.saved")) => {
    setBusy(key);
    try {
      await fn();
      toast(okMsg);
      router.refresh();
      return true;
    } catch (e) {
      const s = apiErrorState(e, t);
      toast(Object.values(s.fields)[0] ?? s.form, "error");
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

/** Workflow: available transitions as buttons → dialog with note / redirect target / resolution. */
export function WorkflowCard({ report }: { report: AdminReportDetailDTO }) {
  const { t } = useI18n();
  const { run } = useAction();
  const [target, setTarget] = useState<AdminReportDetailDTO["transitions"][number] | null>(null);
  const [note, setNote] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [redirectedTo, setRedirectedTo] = useState("");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = (tr: typeof target) => {
    setTarget(tr);
    setNote("");
    setIsPublic(true);
    setRedirectedTo("");
    setResolution(report.resolution ?? "");
    setError(null);
  };
  const submit = async () => {
    if (!target) return;
    if (target.requiresComment && !note.trim()) return setError(t("admin.detail.noteRequired"));
    if (target.key === "redirected" && !redirectedTo.trim()) return setError(t("validation.required"));
    setBusy(true);
    const ok = await run("status", () =>
      api(`/api/reports/${report.id}/status`, {
        json: { status: target.key, note: note || null, isPublic, redirectedTo: redirectedTo || null, resolution: resolution || null },
      }),
    );
    setBusy(false);
    if (ok) setTarget(null);
  };
  return (
    <Card title={t("admin.detail.workflow")}>
      <p className="mb-3 flex items-center gap-2 text-sm">
        {t("report.status")}:
        <span className="rounded px-2 py-0.5 font-bold text-white" style={{ backgroundColor: report.status.color }}>
          {report.status.label}
        </span>
      </p>
      {!report.canProcess ? (
        <p className="text-sm text-slate-500">{t("errors.FORBIDDEN")}</p>
      ) : report.transitions.length === 0 ? (
        <p className="text-sm text-slate-500">{t("admin.detail.noTransitions")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {report.transitions.map((tr) => (
            <button
              key={tr.key}
              type="button"
              onClick={() => open(tr)}
              className="flex min-h-11 items-center gap-2 rounded-md border-2 px-3 text-left font-semibold hover:bg-slate-50"
              style={{ borderColor: tr.color }}
              data-testid={`transition-${tr.key}`}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tr.color }} aria-hidden="true" />
              {t("admin.detail.transitionTo", { status: tr.label })}
              {tr.requiresComment && <Icon name="message" size={14} className="ml-auto text-slate-400" label={t("admin.workflow.requiresComment")} />}
            </button>
          ))}
        </div>
      )}
      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title={target ? t("admin.detail.transitionTo", { status: target.label }) : ""}
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} loading={busy} data-testid="confirm-transition">
              {t("common.confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          {target?.key === "redirected" && (
            <Field label={t("admin.detail.redirectTarget")} required>
              {(p) => <Input {...p} value={redirectedTo} onChange={(e) => setRedirectedTo(e.target.value)} maxLength={200} />}
            </Field>
          )}
          <Field label={t("admin.detail.note")} required={target?.requiresComment} counter={{ value: note.length, max: 2000 }}>
            {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className="min-h-24" />}
          </Field>
          <Checkbox checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} label={t("admin.detail.notePublic")} />
          {target && report.transitions.find((x) => x.key === target.key) && ["resolved"].includes(target.key) && (
            <Field label={t("admin.detail.resolutionText")}>
              {(p) => <Textarea {...p} value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={2000} className="min-h-20" />}
            </Field>
          )}
        </div>
      </Modal>
    </Card>
  );
}

export function AssignmentCard({ report, departments }: { report: AdminReportDetailDTO; departments: Dept[] }) {
  const { t } = useI18n();
  const { busy, run } = useAction();
  const [dept, setDept] = useState(report.department?.id ?? "");
  const [emp, setEmp] = useState(report.assignee?.id ?? "");
  const [due, setDue] = useState(report.dueAt ? report.dueAt.slice(0, 10) : "");
  const employees = departments.find((d) => d.id === dept)?.employees ?? [];
  const disabled = !report.canAssign;
  return (
    <Card title={t("admin.detail.assignment")}>
      <div className="space-y-3">
        <Field label={t("admin.detail.department")}>
          {(p) => (
            <Select
              {...p}
              value={dept}
              disabled={disabled}
              onChange={(e) => {
                setDept(e.target.value);
                setEmp("");
              }}
            >
              <option value="">— {t("admin.reports.unassigned")}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("admin.detail.assignee")}>
          {(p) => (
            <Select {...p} value={emp} disabled={disabled || !dept} onChange={(e) => setEmp(e.target.value)} data-testid="assignee-select">
              <option value="">— {t("admin.reports.unassigned")}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("admin.detail.due")}>
          {(p) => <Input {...p} type="date" value={due} disabled={disabled} onChange={(e) => setDue(e.target.value)} />}
        </Field>
        {!disabled && (
          <Button
            fullWidth
            loading={busy === "assign"}
            onClick={() =>
              run("assign", () =>
                api(`/api/reports/${report.id}`, {
                  method: "PATCH",
                  json: { departmentId: dept || null, assigneeId: emp || null, dueAt: due || null },
                }),
              )
            }
          >
            {t("admin.detail.assign")}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function ClassificationCard({ report, categories }: { report: AdminReportDetailDTO; categories: CategoryDTO[] }) {
  const { t } = useI18n();
  const { busy, run } = useAction();
  const [title, setTitle] = useState(report.title);
  const [cat, setCat] = useState(report.category.id);
  const [sub, setSub] = useState(report.subcategory?.id ?? "");
  const [isPublic, setIsPublic] = useState(report.isPublic);
  const children = categories.find((c) => c.id === cat)?.children ?? [];
  const disabled = !report.canEdit;
  return (
    <Card title={t("admin.detail.classification")}>
      <div className="space-y-3">
        <Field label={t("admin.detail.title")}>{(p) => <Input {...p} value={title} disabled={disabled} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}</Field>
        <Field label={t("report.category")}>
          {(p) => (
            <Select
              {...p}
              value={cat}
              disabled={disabled}
              onChange={(e) => {
                setCat(e.target.value);
                setSub("");
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {children.length > 0 && (
          <Field label={t("report.subcategory")}>
            {(p) => (
              <Select {...p} value={sub} disabled={disabled} onChange={(e) => setSub(e.target.value)}>
                <option value="">—</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Checkbox checked={isPublic} disabled={disabled} onChange={(e) => setIsPublic(e.target.checked)} label={t("admin.detail.publicVisible")} />
        {!disabled && (
          <Button
            fullWidth
            variant="secondary"
            loading={busy === "cat"}
            onClick={() =>
              run("cat", () =>
                api(`/api/reports/${report.id}`, {
                  method: "PATCH",
                  json: { title, categoryId: cat, subcategoryId: sub || null, isPublic },
                }),
              )
            }
          >
            {t("common.save")}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function LocationCard({ report }: { report: AdminReportDetailDTO }) {
  const { t } = useI18n();
  const { busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState<PickedLocation | null>(report.location ? { ...report.location, source: "admin" } : null);
  const l = report.location;
  return (
    <Card title={t("report.location")}>
      <p className="text-sm text-slate-800">
        {l ? l.formattedAddress || `${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}` : t("map.noLocation")}
        {l?.district && <span className="block text-slate-500">{l.district}</span>}
      </p>
      {l && (
        <a
          className="link mt-1 inline-block text-sm"
          href={`https://www.openstreetmap.org/?mlat=${l.lat}&mlon=${l.lng}#map=18/${l.lat}/${l.lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap ↗
        </a>
      )}
      {report.canEdit && (
        <Button size="sm" variant="outline" icon="pin" className="mt-3" onClick={() => setOpen(true)}>
          {t("admin.detail.editLocation")}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("admin.detail.editLocation")}
        size="lg"
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={busy === "loc"}
              disabled={!loc}
              onClick={async () => {
                if (await run("loc", () => api(`/api/reports/${report.id}`, { method: "PATCH", json: { location: loc ? { ...loc, source: "admin" } : null } })))
                  setOpen(false);
              }}
            >
              {t("admin.detail.saveLocation")}
            </Button>
          </>
        }
      >
        {open && <LocationPicker value={loc} onChange={setLoc} mapClassName="h-[50vh] min-h-[260px]" />}
      </Modal>
    </Card>
  );
}

export function ConversationCard({ report, canPublic, canInternal }: { report: AdminReportDetailDTO; canPublic: boolean; canInternal: boolean }) {
  const { t, locale } = useI18n();
  const { busy, run } = useAction();
  const kinds = [
    ...(canPublic && report.canProcess ? (["UPDATE", "RESPONSE"] as const) : []),
    ...(canInternal ? (["NOTE"] as const) : []),
  ];
  const [kind, setKind] = useState<(typeof kinds)[number] | undefined>(kinds[0]);
  const [body, setBody] = useState("");
  const label = { UPDATE: t("admin.detail.kindUpdate"), RESPONSE: t("admin.detail.kindResponse"), NOTE: t("admin.detail.kindNote") };
  return (
    <Card title={t("admin.detail.conversation")}>
      <ul className="space-y-3">
        {report.comments.length === 0 && <li className="text-sm text-slate-500">{t("report.noUpdates")}</li>}
        {report.comments.map((c) => (
          <li
            key={c.id}
            className={cn(
              "rounded-lg border p-3",
              c.kind === "NOTE" && "border-amber-200 bg-amber-50",
              c.kind === "RESPONSE" && "border-green-200 bg-green-50",
              c.kind === "UPDATE" && "border-slate-200 bg-slate-50",
              c.kind === "CITIZEN" && "border-sky-200 bg-sky-50",
            )}
          >
            <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="rounded bg-white/70 px-1.5 py-0.5 font-bold uppercase tracking-wide">
                {c.kind === "NOTE" ? t("admin.detail.internal") : c.kind === "CITIZEN" ? t("admin.detail.citizen") : c.kind === "RESPONSE" ? t("report.response") : t("admin.detail.public")}
              </span>
              <span className="font-semibold">{c.authorName}</span>
              <time dateTime={c.at}>{formatDateTime(c.at, locale)}</time>
            </p>
            <p className="whitespace-pre-wrap text-sm">{c.body}</p>
          </li>
        ))}
      </ul>
      {kind && (
        <form
          className="mt-4 space-y-2 border-t border-slate-100 pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim()) return;
            if (await run("comment", () => api(`/api/reports/${report.id}/comments`, { json: { body, kind } }))) setBody("");
          }}
        >
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("admin.detail.addUpdate")}>
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-sm font-semibold",
                  kind === k ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-700",
                )}
              >
                {label[k]}
              </button>
            ))}
          </div>
          <label htmlFor="comment-body" className="sr-only">
            {label[kind]}
          </label>
          <Textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} className="min-h-24" data-testid="comment-body" />
          <Button type="submit" loading={busy === "comment"} icon="message" disabled={!body.trim()}>
            {t("admin.detail.addUpdate")}
          </Button>
        </form>
      )}
    </Card>
  );
}

export function AttachmentsCard({ report, canUpload }: { report: AdminReportDetailDTO; canUpload: boolean }) {
  const { t } = useI18n();
  const { busy, run } = useAction();
  const [pub, setPub] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  return (
    <Card title={t("report.attachments")}>
      {report.attachments.length === 0 ? (
        <p className="text-sm text-slate-500">—</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {report.attachments.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-md ring-1 ring-slate-200">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-slate-100">
                {a.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs">
                    <Icon name="file" size={28} /> {a.name}
                  </span>
                )}
              </a>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs">
                <span className={cn("font-semibold", a.kind === "ADMIN" ? "text-primary" : "text-slate-600")}>{a.kind === "ADMIN" ? t("admin.detail.staff") : t("admin.detail.citizen")}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-slate-100"
                  onClick={() => run(`vis-${a.id}`, () => api(`/api/attachments/${a.id}`, { method: "PATCH", json: { isPublic: !a.isPublic } }))}
                  aria-label={a.isPublic ? t("admin.detail.hidePhoto") : t("admin.detail.showPhoto")}
                  title={a.isPublic ? t("admin.detail.hidePhoto") : t("admin.detail.showPhoto")}
                >
                  <Icon name={a.isPublic ? "eye" : "eyeOff"} size={14} />
                  {a.isPublic ? t("admin.detail.public") : t("admin.detail.internal")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {canUpload && report.canProcess && (
        <form
          className="mt-4 space-y-2 border-t border-slate-100 pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!files?.length) return;
            const form = new FormData();
            Array.from(files).forEach((f) => form.append("files", f, f.name));
            form.set("isPublic", String(pub));
            if (await run("upload", () => api(`/api/reports/${report.id}/attachments`, { form }))) {
              setFiles(null);
              (e.target as HTMLFormElement).reset();
            }
          }}
        >
          <label className="label" htmlFor="admin-upload">
            {t("admin.detail.uploadAdmin")}
          </label>
          <input id="admin-upload" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFiles(e.target.files)} className="block w-full text-sm" />
          <Checkbox checked={pub} onChange={(e) => setPub(e.target.checked)} label={t("admin.detail.uploadPublic")} />
          <Button type="submit" size="sm" icon="upload" loading={busy === "upload"} disabled={!files?.length}>
            {t("admin.detail.uploadAdmin")}
          </Button>
        </form>
      )}
    </Card>
  );
}

export function AuditCard({ report }: { report: AdminReportDetailDTO }) {
  const { t, locale } = useI18n();
  return (
    <details className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer font-bold">
        {t("admin.detail.audit")} <span className="font-normal text-slate-500">({report.audit.length})</span>
      </summary>
      <ol className="mt-3 space-y-2 text-sm">
        {report.audit.map((a) => (
          <li key={a.id} className="border-l-2 border-slate-200 pl-3">
            <p>
              <code className="rounded bg-slate-100 px-1 text-xs">{a.action}</code> · <span className="font-semibold">{a.actorName ?? t("admin.audit.system")}</span>
            </p>
            <p className="text-xs text-slate-500">{formatDateTime(a.at, locale)}</p>
            {a.data != null && <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(a.data, null, 1)}</pre>}
          </li>
        ))}
      </ol>
    </details>
  );
}

