"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/**
 * Accessible modal built on the native <dialog> element:
 * focus trapping, Escape to close, inert background and focus restore come from the browser.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  variant = "default",
  closeLabel = "Close",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "brand";
  closeLabel?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const restore = useRef<Element | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      restore.current = document.activeElement;
      d.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && d.open) {
      d.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    const onCloseEv = () => {
      document.documentElement.style.overflow = "";
      (restore.current as HTMLElement | null)?.focus?.();
    };
    d.addEventListener("cancel", onCancel);
    d.addEventListener("close", onCloseEv);
    return () => {
      d.removeEventListener("cancel", onCancel);
      d.removeEventListener("close", onCloseEv);
    };
  }, [onClose]);

  const widths = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" };
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      className={cn(
        "m-0 h-full max-h-none w-full max-w-none p-0 backdrop:animate-fade-in open:animate-pop-in",
        "sm:m-auto sm:h-auto sm:max-h-[calc(100vh-4rem)] sm:rounded-lg sm:shadow-2xl",
        widths[size],
        className,
      )}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col bg-white">
          <header
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6",
              variant === "brand" ? "bg-primary text-white" : "border-b border-slate-200",
            )}
          >
            <h2 id="modal-title" className="text-xl font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                variant === "brand" ? "border-2 border-white/80 hover:bg-white/10" : "hover:bg-slate-100",
              )}
              aria-label={closeLabel}
            >
              <Icon name="close" size={22} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">{children}</div>
          {footer && <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:justify-end sm:px-6">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/**
 * Side / bottom drawer (mobile filters, admin navigation).
 * Implemented as a fixed overlay rather than <dialog>, because iOS WebKit renders
 * bottom-anchored modal dialogs unreliably. Escape closes, focus moves in and is
 * restored, background scroll is locked, Tab is kept inside.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "left",
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: "left" | "right" | "bottom";
  closeLabel?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])') ?? [],
      );
    requestAnimationFrame(() => (focusables()[0] ?? panel.current)?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
      (restore.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const pos = {
    left: "inset-y-0 left-0 w-[min(22rem,90vw)]",
    right: "inset-y-0 right-0 w-[min(24rem,92vw)] animate-slide-left",
    bottom: "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up",
  }[side];
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/55" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn("absolute flex flex-col bg-white shadow-2xl outline-none", pos)}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-10 w-10 place-items-center rounded-full hover:bg-slate-100">
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
