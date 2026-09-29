import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./States";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "cta" | "outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark border border-primary",
  secondary: "bg-white text-primary border border-primary hover:bg-primary-light/60",
  outline: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent",
  danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
  cta: "bg-accent text-white hover:bg-accent-dark border-2 border-white shadow-lg rounded-full",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm rounded-md",
  md: "min-h-11 px-4 text-base rounded-md",
  lg: "min-h-12 px-6 text-lg rounded-md",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, iconRight, fullWidth, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={size === "sm" ? 16 : 18} />}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  fullWidth,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  className?: string;
  fullWidth?: boolean;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={18} />}
    </Link>
  );
}
