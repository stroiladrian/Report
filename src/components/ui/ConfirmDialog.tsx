"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useI18n } from "@/lib/i18n/client";

type ConfirmOpts = { title: string; message?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
const Ctx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

/** `const confirm = useConfirm(); if (await confirm({...})) …` – accessible replacement for window.confirm. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o);
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);
  const done = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => done(false)}
        title={opts?.title ?? ""}
        size="sm"
        closeLabel={t("common.close")}
        footer={
          <>
            <Button variant="outline" onClick={() => done(false)}>
              {opts?.cancelLabel ?? t("common.cancel")}
            </Button>
            <Button variant={opts?.danger ? "danger" : "primary"} onClick={() => done(true)} autoFocus>
              {opts?.confirmLabel ?? t("common.confirm")}
            </Button>
          </>
        }
      >
        {opts?.message && <div className="text-slate-700">{opts.message}</div>}
      </Modal>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
