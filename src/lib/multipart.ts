import type { NextRequest } from "next/server";
import { appConfig } from "@config/app";
import { Errors } from "./errors";
import type { UploadFile } from "@/server/services/reports";

/** Parses multipart/form-data with a JSON "data" field and "files" entries. */
export async function parseMultipart(req: NextRequest): Promise<{ data: unknown; files: UploadFile[]; fields: FormData }> {
  const max = appConfig.uploads.maxFiles * appConfig.uploads.maxFileSizeMB * 1024 * 1024 + 2 * 1024 * 1024;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > max) throw Errors.validation("Upload too large", { fieldErrors: { files: ["size"] } });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw Errors.badRequest("Invalid multipart body");
  }
  let data: unknown = {};
  const raw = form.get("data");
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      throw Errors.badRequest("Field 'data' must be JSON");
    }
  }
  const files: UploadFile[] = [];
  for (const entry of form.getAll("files")) {
    if (typeof entry === "string") continue;
    if (files.length >= appConfig.uploads.maxFiles + 1) break;
    const buf = Buffer.from(await entry.arrayBuffer());
    files.push({ name: entry.name || "file", size: entry.size, type: entry.type, data: buf });
  }
  return { data, files, fields: form };
}

export function isMultipart(req: NextRequest) {
  return (req.headers.get("content-type") ?? "").startsWith("multipart/form-data");
}
