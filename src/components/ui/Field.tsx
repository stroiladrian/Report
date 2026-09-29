import { forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

type FieldProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  counter?: { value: number; max: number };
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean }) => React.ReactNode;
};

/** Label + control + hint/error wiring (aria-describedby, aria-invalid). */
export function Field({ label, hint, error, required, className, counter, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {required && (
            <span className="text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required })}
      <div className="mt-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {error && (
            <p id={errId} className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          {hint && !error && (
            <p id={hintId} className="text-sm text-slate-600">
              {hint}
            </p>
          )}
        </div>
        {counter && (
          <span className={cn("shrink-0 text-xs tabular-nums", counter.value > counter.max ? "text-red-700" : "text-slate-500")} aria-live="polite">
            {counter.value} / {counter.max}
          </span>
        )}
      </div>
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn("input", className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn("input min-h-32 resize-y", className)} {...p} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return (
    <select ref={ref} className={cn("input appearance-auto pr-8", className)} {...p}>
      {children}
    </select>
  );
});

export function Checkbox({ label, className, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input id={p.id ?? id} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--c-primary))]" {...p} />
      <label htmlFor={p.id ?? id} className="text-sm text-slate-800">
        {label}
      </label>
    </div>
  );
}
