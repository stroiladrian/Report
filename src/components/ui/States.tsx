import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-3 p-6 text-slate-600", className)}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-slate-200", className)} aria-hidden="true" />;
}

export function EmptyState({
  icon = "info",
  title,
  text,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  text?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Icon name={icon} size={24} />
      </span>
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="max-w-sm text-sm text-slate-600">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, text, onRetry, retryLabel }: { title: string; text?: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
        <Icon name="alert" size={24} />
      </span>
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="text-sm text-slate-600">{text}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="link mt-1">
          {retryLabel ?? "Retry"}
        </button>
      )}
    </div>
  );
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "warning" | "error" | "success"; children: React.ReactNode; className?: string }) {
  const styles = {
    info: "bg-sky-50 border-sky-300 text-sky-900",
    warning: "bg-amber-50 border-amber-300 text-amber-900",
    error: "bg-red-50 border-red-300 text-red-900",
    success: "bg-green-50 border-green-300 text-green-900",
  }[tone];
  const icon: IconName = tone === "success" ? "check" : tone === "info" ? "info" : "alert";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-2 rounded-md border px-3 py-2 text-sm", styles, className)}>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
