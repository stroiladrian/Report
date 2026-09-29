"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { appConfig } from "@config/app";
import { ApiError, uploadWithProgress } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { apiErrorState } from "@/lib/form-errors";
import { useI18n } from "@/lib/i18n/client";
import type { CategoryDTO } from "@/types/reports";
import { Alert } from "@/components/ui/States";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { FileUploader, type PendingFile } from "@/components/ui/FileUploader";
import { Icon } from "@/components/ui/Icon";
import { Stepper } from "@/components/ui/Stepper";
import { LocationPicker, type PickedLocation } from "@/components/map/LocationPicker";

const R = appConfig.reports;
type Step = 0 | 1 | 2 | 3 | 4;

/** Multi-step "report an issue" flow: location → category → description → photos → review → confirmation. */
export function ReportWizard({ categories }: { categories: CategoryDTO[] }) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(0);
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [noLocation, setNoLocation] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ number: string } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  /** Bumped on every failed validation so the effect below runs after the errors are rendered. */
  const [errorTick, setErrorTick] = useState(0);

  const category = categories.find((c) => c.id === categoryId);
  const sub = category?.children.find((c) => c.id === subcategoryId);
  const dirty = !!(location || categoryId || title || description || files.length);

  useEffect(() => {
    if (!dirty || result) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = t("create.leaveConfirm");
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, result, t]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, result]);

  // Bring the first invalid field into view (important on phones, where it may be off-screen
  // above the sticky "Continue" bar) and focus it so screen readers announce the error.
  useEffect(() => {
    if (!errorTick) return;
    const el = sectionRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error]');
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    if (el.matches("input, select, textarea, button")) el.focus({ preventScroll: true });
  }, [errorTick]);

  const steps = [
    { id: "location", label: t("create.steps.location") },
    { id: "category", label: t("create.steps.category") },
    { id: "description", label: t("create.steps.description") },
    { id: "photos", label: t("create.steps.photos") },
    { id: "review", label: t("create.steps.review") },
  ];

  const validate = (s: Step): boolean => {
    const e: Record<string, string> = {};
    if (s === 0 && !noLocation && !location) e.location = t("validation.location");
    if (s === 1) {
      if (!category) e.category = t("validation.category");
      else if (category.children.length && !sub) e.subcategory = t("validation.subcategory");
    }
    if (s === 2) {
      if (title.trim().length < R.titleMin) e.title = t("validation.min", { min: R.titleMin });
      if (title.length > R.titleMax) e.title = t("validation.max", { max: R.titleMax });
      if (description.trim().length < R.descriptionMin) e.description = t("validation.min", { min: R.descriptionMin });
      if (description.length > R.descriptionMax) e.description = t("validation.max", { max: R.descriptionMax });
    }
    if (s === 4 && !consent) e.consent = t("validation.consent");
    setErrors(e);
    const ok = Object.keys(e).length === 0;
    if (!ok) setErrorTick((n) => n + 1);
    return ok;
  };

  const next = () => {
    if (validate(step)) setStep((s) => Math.min(4, s + 1) as Step);
  };
  const back = () => setStep((s) => Math.max(0, s - 1) as Step);

  const submit = async () => {
    if (!validate(4)) return;
    setSubmitting(true);
    setFormError(null);
    setProgress(0);
    const form = new FormData();
    form.set(
      "data",
      JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        subcategoryId: subcategoryId || null,
        location: noLocation || !location ? null : location,
      }),
    );
    files.forEach((f) => form.append("files", f.file, f.file.name));
    try {
      const res = await uploadWithProgress<{ number: string }>("/api/reports", form, setProgress);
      setResult(res);
      window.scrollTo({ top: 0 });
    } catch (e) {
      const s = apiErrorState(e, t);
      setFormError(e instanceof ApiError && e.code === "UNVERIFIED" ? t("create.verifyRequired") : s.form);
      const f = s.fields;
      setErrors({
        ...(f.title ? { title: f.title } : {}),
        ...(f.description ? { description: f.description } : {}),
        ...(f.categoryId ? { category: f.categoryId } : {}),
        ...(f.subcategoryId ? { subcategory: f.subcategoryId } : {}),
        ...(f.location ? { location: f.location } : {}),
        ...(f.files ? { files: f.files } : {}),
      });
      setErrorTick((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mx-auto max-w-xl py-6 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-green-100 text-green-700">
          <Icon name="check" size={36} strokeWidth={3} />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {t("create.success.title")}
        </h1>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{t("create.success.number")}</p>
        <p className="mt-1 text-3xl font-extrabold text-primary" data-testid="report-number">
          {result.number}
        </p>
        <p className="mt-4 text-slate-700">{t("create.success.text")}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href={`/reports/${result.number}`} iconRight="arrowRight">
            {t("create.success.view")}
          </ButtonLink>
          <ButtonLink href="/account/reports" variant="secondary">
            {t("create.success.myReports")}
          </ButtonLink>
        </div>
        <a href="/submit" className="link mt-4 inline-block text-sm">
          {t("create.success.another")}
        </a>
      </div>
    );
  }

  const address = location ? location.formattedAddress || `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : null;

  return (
    <div className="space-y-6">
      <Stepper
        steps={steps}
        current={step}
        onSelect={(i) => setStep(i as Step)}
        label={t("create.title")}
        stepOf={t("create.stepOf", { step: step + 1, total: steps.length })}
      />

      <section ref={sectionRef} aria-labelledby="step-h" className="rounded-lg bg-white">
        <h2 id="step-h" ref={headingRef} tabIndex={-1} className="mb-1 text-xl font-bold outline-none sm:text-2xl">
          {step === 0 && t("create.location.heading")}
          {step === 1 && t("create.category.heading")}
          {step === 2 && t("create.description.heading")}
          {step === 3 && t("create.photos.heading")}
          {step === 4 && t("create.review.heading")}
        </h2>

        {step === 0 && (
          <div className="space-y-3">
            <p className="text-slate-600">{t("create.location.hint")}</p>
            {!noLocation && <LocationPicker value={location} onChange={setLocation} />}
            <Checkbox checked={noLocation} onChange={(e) => setNoLocation(e.target.checked)} label={t("create.location.noLocation")} />
            {errors.location && <p data-error className="text-sm font-medium text-red-700" role="alert">{errors.location}</p>}
          </div>
        )}

        {step === 1 && (
          <div className="mt-3 space-y-4">
            <fieldset>
              <legend className="sr-only">{t("report.category")}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup">
                {categories.map((c) => {
                  const on = c.id === categoryId;
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 py-2 transition-colors",
                        on ? "border-primary bg-primary-light/40" : "border-slate-200 hover:border-slate-400",
                      )}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={c.id}
                        checked={on}
                        onChange={() => {
                          setCategoryId(c.id);
                          setSubcategoryId("");
                          setErrors(({ category: _c, subcategory: _s, ...rest }) => rest);
                        }}
                        className="sr-only"
                      />
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${c.color}22`, color: c.color }} aria-hidden="true">
                        <Icon name="tag" size={18} />
                      </span>
                      <span className="font-semibold leading-tight">{c.name}</span>
                      {on && <Icon name="check" size={20} className="ml-auto text-primary" />}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {errors.category && <p data-error className="text-sm font-medium text-red-700" role="alert">{errors.category}</p>}
            {category && category.children.length > 0 && (
              <Field label={t("create.category.subcategory")} required error={errors.subcategory} className="max-w-md">
                {(p) => (
                  <Select
                    {...p}
                    value={subcategoryId}
                    onChange={(e) => {
                      setSubcategoryId(e.target.value);
                      if (e.target.value) setErrors(({ subcategory: _s, ...rest }) => rest);
                    }}
                  >
                    <option value="">{t("create.category.chooseSub")}</option>
                    {category.children.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {(sub?.notice || category?.notice) && <Alert tone="warning">{sub?.notice || category?.notice}</Alert>}
          </div>
        )}

        {step === 2 && (
          <div className="mt-3 space-y-4">
            <Field label={t("create.description.title")} required error={errors.title} counter={{ value: title.length, max: R.titleMax }}>
              {(p) => <Input {...p} value={title} maxLength={R.titleMax} placeholder={t("create.description.titlePlaceholder")} onChange={(e) => setTitle(e.target.value)} />}
            </Field>
            <Field
              label={t("create.description.body")}
              required
              error={errors.description}
              hint={t("create.description.tips")}
              counter={{ value: description.length, max: R.descriptionMax }}
            >
              {(p) => (
                <Textarea {...p} value={description} maxLength={R.descriptionMax} rows={8} placeholder={t("create.description.bodyPlaceholder")} onChange={(e) => setDescription(e.target.value)} />
              )}
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="mt-3">
            <FileUploader files={files} onChange={setFiles} />
            {errors.files && <p data-error className="mt-2 text-sm font-medium text-red-700" role="alert">{errors.files}</p>}
          </div>
        )}

        {step === 4 && (
          <div className="mt-3 space-y-4">
            <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200">
              {[
                { k: t("report.location"), v: noLocation ? t("map.noLocation") : address, s: 0 },
                { k: t("report.category"), v: [category?.name, sub?.name].filter(Boolean).join(" › "), s: 1 },
                { k: t("create.description.title"), v: title, s: 2 },
                { k: t("create.description.body"), v: <span className="whitespace-pre-wrap">{description}</span>, s: 2 },
                {
                  k: t("create.steps.photos"),
                  v: files.length ? (
                    <span className="flex flex-wrap gap-1.5">
                      {files.map((f) =>
                        f.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={f.id} src={f.preview} alt={f.file.name} className="h-14 w-14 rounded object-cover" />
                        ) : (
                          <span key={f.id} className="rounded bg-slate-100 px-2 py-1 text-xs">{f.file.name}</span>
                        ),
                      )}
                    </span>
                  ) : (
                    t("create.review.noPhotos")
                  ),
                  s: 3,
                },
              ].map((row, i) => (
                <div key={i} className="grid gap-1 p-3 sm:grid-cols-[10rem_1fr_auto] sm:gap-3">
                  <dt className="font-semibold text-slate-700">{row.k}</dt>
                  <dd className="min-w-0 break-words text-slate-900">{row.v}</dd>
                  <dd>
                    <button type="button" className="link text-sm" onClick={() => setStep(row.s as Step)}>
                      {t("create.review.edit")}
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
            <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t("create.review.consent")} aria-invalid={!!errors.consent || undefined} />
            {errors.consent && <p className="text-sm font-medium text-red-700">{errors.consent}</p>}
            {formError && (
              <Alert tone="error">
                {formError}
                {formError === t("create.verifyRequired") && (
                  <>
                    {" "}
                    <Link href="/account" className="font-semibold underline">
                      {t("header.account")}
                    </Link>
                  </>
                )}
              </Alert>
            )}
            {submitting && (
              <div aria-live="polite">
                <p className="mb-1 text-sm font-medium">{t("create.submitting")}</p>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-20 -mx-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        {step > 0 ? (
          <Button variant="outline" onClick={back} icon="arrowLeft" disabled={submitting}>
            {t("common.back")}
          </Button>
        ) : (
          <ButtonLink href="/" variant="outline">
            {t("common.cancel")}
          </ButtonLink>
        )}
        <div className="flex-1" />
        {step < 4 ? (
          <Button onClick={next} iconRight="arrowRight" className="min-w-36">
            {t("common.next")}
          </Button>
        ) : (
          <Button onClick={submit} loading={submitting} className="min-w-44" icon="check">
            {t("create.submit")}
          </Button>
        )}
      </div>
    </div>
  );
}
