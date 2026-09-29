"use client";

import { useRouter } from "next/navigation";

/** GET form that navigates on change (selects/checkboxes) and on submit (search). Works without JS too. */
export function AutoSubmitForm({ action, children, className }: { action: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const go = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    new FormData(form).forEach((v, k) => {
      if (typeof v === "string" && v !== "") params.append(k, v);
    });
    router.push(`${action}?${params.toString()}`);
  };
  return (
    <form
      action={action}
      method="get"
      className={className}
      role="search"
      onChange={(e) => {
        const el = e.target as HTMLElement;
        if (el.tagName === "SELECT" || (el as HTMLInputElement).type === "checkbox") go(e.currentTarget);
      }}
      onSubmit={(e) => {
        e.preventDefault();
        go(e.currentTarget);
      }}
    >
      {children}
    </form>
  );
}
