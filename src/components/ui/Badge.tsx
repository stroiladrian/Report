import { cn } from "@/lib/cn";

export function Badge({ children, className, color }: { children: React.ReactNode; className?: string; color?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold", !color && "bg-slate-100 text-slate-700", className)}
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      {children}
    </span>
  );
}

/** Solid status pill (white text on the status colour), as in the reference detail view. */
export function StatusBadge({ label, color, size = "md", className }: { label: string; color: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-bold text-white",
        size === "sm" && "rounded px-2 py-0.5 text-xs",
        size === "md" && "rounded px-2.5 py-1 text-sm",
        size === "lg" && "w-full px-3 py-1.5 text-base",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

export function StatusDot({ color, className, hollow }: { color: string; className?: string; hollow?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-3 w-3 shrink-0 rounded-full border-2", className)}
      style={{ borderColor: color, backgroundColor: hollow ? "transparent" : color }}
    />
  );
}
