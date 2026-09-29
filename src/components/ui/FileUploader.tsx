"use client";

import { useEffect, useId, useRef, useState } from "react";
import { appConfig } from "@config/app";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/client";
import { Icon } from "./Icon";
import { useConfirm } from "./ConfirmDialog";

export type PendingFile = { id: string; file: File; preview: string | null };

const ACCEPT = appConfig.uploads.allowedMimeTypes.join(",");

/**
 * Drag & drop / click-to-choose uploader with previews and delete confirmation.
 * Client-side checks are a convenience only – the server validates again (type sniffing, size, count).
 */
export function FileUploader({
  files,
  onChange,
  max = appConfig.uploads.maxFiles,
  maxSizeMB = appConfig.uploads.maxFileSizeMB,
  accept = ACCEPT,
}: {
  files: PendingFile[];
  onChange: (f: PendingFile[]) => void;
  max?: number;
  maxSizeMB?: number;
  accept?: string;
}) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => () => filesRef.current.forEach((f) => f.preview && URL.revokeObjectURL(f.preview)), []);

  const add = (list: FileList | File[]) => {
    const errs: string[] = [];
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= max) {
        errs.push(t("create.photos.tooMany", { max }));
        break;
      }
      if (!accept.split(",").includes(file.type)) {
        errs.push(t("create.photos.badType", { name: file.name }));
        continue;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        errs.push(t("create.photos.tooBig", { name: file.name, size: maxSizeMB }));
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${Math.random()}`, file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
    }
    setErrors(errs);
    onChange(next);
  };

  const remove = async (f: PendingFile) => {
    if (!(await confirm({ title: t("create.photos.remove"), message: t("create.photos.confirmRemove"), confirmLabel: t("common.delete"), danger: true }))) return;
    if (f.preview) URL.revokeObjectURL(f.preview);
    onChange(files.filter((x) => x.id !== f.id));
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "relative flex min-h-28 cursor-pointer flex-col focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
          drag ? "border-primary bg-primary-light/40" : "border-slate-300 bg-slate-50 hover:border-primary",
          files.length >= max && "pointer-events-none opacity-50",
        )}
      >
        <Icon name="camera" size={28} className="text-primary" />
        <span className="font-semibold text-slate-800">{t("create.photos.drop")}</span>
        <span className="text-sm text-slate-600">{t("create.photos.hint", { max, size: maxSizeMB })}</span>
        <input
          ref={input}
          id={id}
          type="file"
          multiple
          accept={accept}
          // The (invisible) input covers the whole drop zone so a tap lands directly on it.
          // Relying on <label> forwarding the tap is unreliable in iOS Safari.
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          disabled={files.length >= max}
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm font-medium text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((f) => (
            <li key={f.id} className="relative aspect-[4/3] overflow-hidden rounded-md bg-slate-200">
              {f.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.preview} alt={f.file.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-slate-700">
                  <Icon name="file" size={28} />
                  <span className="line-clamp-2 break-all">{f.file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => remove(f)}
                aria-label={`${t("create.photos.remove")}: ${f.file.name}`}
                className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded bg-red-600 text-white shadow hover:bg-red-700"
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
