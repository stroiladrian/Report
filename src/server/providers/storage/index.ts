/**
 * File storage abstraction. Files are addressed by an opaque key
 * (e.g. "2026/09/5f1c…e2.jpg"); filesystem paths are never exposed to clients –
 * files are streamed through /api/files/:attachmentId after an access check.
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export class LocalDiskStorage implements StorageProvider {
  readonly name = "local";
  constructor(private root: string) {}

  private resolve(key: string) {
    if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data, { mode: 0o640 });
  }
  async get(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}

/**
 * Vercel Blob storage (for serverless hosting where the disk is ephemeral).
 * Blob URLs are never exposed to clients: files are fetched server-side and streamed through
 * /api/files/:id after the access check. Requires BLOB_READ_WRITE_TOKEN.
 */
export class VercelBlobStorage implements StorageProvider {
  readonly name = "blob";
  /** Match the access level of your Blob store (Vercel creates private stores by default). */
  private access = (process.env.BLOB_ACCESS === "public" ? "public" : "private") as "public" | "private";

  private check(key: string) {
    if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
  }
  async put(key: string, data: Buffer, contentType: string) {
    this.check(key);
    const { put } = await import("@vercel/blob");
    await put(key, data, { access: this.access, contentType, addRandomSuffix: false, allowOverwrite: true });
  }
  async get(key: string) {
    try {
      this.check(key);
      const { get } = await import("@vercel/blob");
      const res = await get(key, { access: this.access, useCache: false });
      if (!res || res.statusCode !== 200) return null;
      return Buffer.from(await new Response(res.stream).arrayBuffer());
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    this.check(key);
    const { del } = await import("@vercel/blob");
    await del(key);
  }
}

let instance: StorageProvider | null = null;
export function getStorage(): StorageProvider {
  if (!instance) {
    const kind = process.env.STORAGE_PROVIDER ?? (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local");
    instance =
      kind === "blob"
        ? new VercelBlobStorage()
        : new LocalDiskStorage(path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads"));
  }
  return instance;
}
