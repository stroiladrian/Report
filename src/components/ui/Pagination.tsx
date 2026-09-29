import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/** Link-based pagination (works without JS). `hrefFor(page)` builds the URL. */
export function Pagination({
  page,
  pages,
  hrefFor,
  onPage,
  labels,
}: {
  page: number;
  pages: number;
  hrefFor?: (p: number) => string;
  onPage?: (p: number) => void;
  labels: { previous: string; next: string; page: string };
}) {
  if (pages <= 1) return null;
  const nums = pageNumbers(page, pages);
  const item = (p: number, content: React.ReactNode, aria: string, disabled = false, current = false) => {
    const cls = cn(
      "grid h-10 min-w-10 place-items-center rounded-md border px-2 text-sm font-semibold",
      current ? "border-primary bg-primary text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
      disabled && "pointer-events-none opacity-40",
    );
    if (onPage)
      return (
        <button type="button" className={cls} aria-label={aria} aria-current={current ? "page" : undefined} disabled={disabled} onClick={() => onPage(p)}>
          {content}
        </button>
      );
    return (
      <Link className={cls} href={hrefFor!(p)} aria-label={aria} aria-current={current ? "page" : undefined} aria-disabled={disabled || undefined} scroll={false}>
        {content}
      </Link>
    );
  };
  return (
    <nav aria-label={labels.page} className="flex flex-wrap items-center justify-center gap-1.5">
      {item(page - 1, <Icon name="chevronLeft" size={18} />, labels.previous, page <= 1)}
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1 text-slate-500">
            …
          </span>
        ) : (
          <span key={n}>{item(n, n, `${n}`, false, n === page)}</span>
        ),
      )}
      {item(page + 1, <Icon name="chevronRight" size={18} />, labels.next, page >= pages)}
    </nav>
  );
}

function pageNumbers(page: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const add = (n: number) => out[out.length - 1] !== n && out.push(n);
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) add(n);
    else if (out[out.length - 1] !== "…") out.push("…");
  }
  return out;
}
