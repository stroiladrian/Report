"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import type { AttachmentDTO } from "@/types/reports";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

/** Thumbnails + keyboard-navigable lightbox carousel (←/→, loop, "n / total"). */
export function PhotoGallery({ photos, size = 96 }: { photos: AttachmentDTO[]; size?: number }) {
  const { t } = useI18n();
  const [index, setIndex] = useState<number | null>(null);
  const n = photos.length;
  const go = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + n) % n)), [n]);
  useEffect(() => {
    if (index === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [index, go]);
  if (!n) return null;
  const cur = index !== null ? photos[index] : null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button type="button" onClick={() => setIndex(i)} className="block overflow-hidden rounded-md ring-offset-2 hover:opacity-90" aria-label={t("map.photo", { n: i + 1 })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} className="bg-slate-200 object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <Modal open={index !== null} onClose={() => setIndex(null)} title={cur ? `${t("map.photo", { n: (index ?? 0) + 1 })} · ${(index ?? 0) + 1} / ${n}` : ""} size="xl" closeLabel={t("common.close")}>
        {cur && (
          <div className="relative flex items-center justify-center bg-slate-900" style={{ minHeight: "50vh" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={t("map.photo", { n: (index ?? 0) + 1 })} className="max-h-[70vh] w-auto max-w-full object-contain" />
            {n > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={t("common.previous")} className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow hover:bg-white">
                  <Icon name="chevronLeft" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label={t("common.next")} className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/90 shadow hover:bg-white">
                  <Icon name="chevronRight" />
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
