"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type Toast = { id: number; tone: "success" | "error" | "info"; text: string };
const Ctx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-md animate-pop-in items-center gap-2 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg",
              t.tone === "success" && "bg-green-700",
              t.tone === "error" && "bg-red-700",
              t.tone === "info" && "bg-slate-800",
            )}
          >
            <Icon name={t.tone === "error" ? "alert" : t.tone === "info" ? "info" : "check"} size={18} />
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
