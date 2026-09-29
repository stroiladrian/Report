"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/** Legacy copy that also works on plain-http pages (e.g. a phone opening the dev server by IP). */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share a report link: native share sheet on phones (HTTPS only), otherwise copy to clipboard,
 * otherwise show the link in a dialog so it can be copied manually.
 */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    const secure = window.isSecureContext;
    if (secure && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // user closed the share sheet
      }
    }
    if (secure && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast(t("common.copied"), "info");
        return;
      } catch {
        /* fall through */
      }
    }
    if (legacyCopy(url)) {
      toast(t("common.copied"), "info");
      return;
    }
    setManualUrl(url);
  };

  return (
    <>
      <Button size="sm" variant="outline" icon="external" onClick={share}>
        {t("report.share")}
      </Button>
      <Modal open={!!manualUrl} onClose={() => setManualUrl(null)} title={t("report.share")} size="sm" closeLabel={t("common.close")}>
        <label htmlFor="share-url" className="label">
          {t("report.shareLink")}
        </label>
        <input
          id="share-url"
          readOnly
          value={manualUrl ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
          className="input text-sm"
        />
      </Modal>
    </>
  );
}
