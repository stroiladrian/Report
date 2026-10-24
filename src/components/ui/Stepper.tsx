import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export function Stepper({
  steps,
  current,
  onSelect,
  label,
  stepOf,
}: {
  steps: { id: string; label: string }[];
  current: number;
  onSelect?: (i: number) => void;
  label: string;
  stepOf: string;
}) {
  return (
    <nav aria-label={label}>
      <p className="mb-2 text-sm font-semibold text-slate-600 sm:hidden">
        {stepOf} · <span className="text-slate-900">{steps[current]?.label}</span>
      </p>
      <ol className="flex items-start">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = !!onSelect && i < current;
          return (
            <li key={s.id} className="flex flex-1 items-start last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onSelect!(i)}
                aria-current={active ? "step" : undefined}
                className="group flex flex-col items-center gap-1 disabled:cursor-default"
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-bold",
                    done && "border-accent bg-accent text-white",
                    active && "border-primary bg-primary text-white",
                    !done && !active && "border-slate-300 bg-white text-slate-500",
                  )}
                >
                  {done ? <Icon name="check" size={16} strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("hidden text-xs font-semibold sm:block", active ? "text-slate-900" : "text-slate-500")}>{s.label}</span>
              </button>
              {i < steps.length - 1 && <span className={cn("mx-1 mt-[15px] h-0.5 min-w-4 flex-1", done ? "bg-accent/60" : "bg-slate-200")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
