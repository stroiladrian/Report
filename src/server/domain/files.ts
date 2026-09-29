/**
 * Upload validation helpers – pure functions (unit tested).
 * The declared MIME type and extension are NOT trusted: the real type is
 * detected from the file's magic bytes and must match the extension.
 */
import { randomUUID } from "node:crypto";
import { appConfig } from "@config/app";

export type AllowedMime = (typeof appConfig.uploads.allowedMimeTypes)[number];

const EXT: Record<AllowedMime, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

export function sniffMime(buf: Buffer): AllowedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

export function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1]!.toLowerCase() : "";
}

export type FileCheck = { ok: true; mime: AllowedMime; ext: string } | { ok: false; reason: "type" | "size" | "extension" | "empty" };

export function validateUpload(
  file: { name: string; size: number; data: Buffer },
  opts: { maxBytes?: number; allowed?: readonly string[] } = {},
): FileCheck {
  const maxBytes = opts.maxBytes ?? appConfig.uploads.maxFileSizeMB * 1024 * 1024;
  const allowed = opts.allowed ?? appConfig.uploads.allowedMimeTypes;
  if (file.size === 0 || file.data.length === 0) return { ok: false, reason: "empty" };
  if (file.size > maxBytes || file.data.length > maxBytes) return { ok: false, reason: "size" };
  const mime = sniffMime(file.data);
  if (!mime || !allowed.includes(mime)) return { ok: false, reason: "type" };
  const ext = extensionOf(file.name);
  if (!EXT[mime].includes(ext)) return { ok: false, reason: "extension" };
  return { ok: true, mime, ext: EXT[mime][0]! };
}

/** Storage key: yyyy/mm/<uuid>.<ext> – never derived from the user's filename. */
export function storageKeyFor(ext: string, now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${randomUUID()}.${ext}`;
}

/** Display name: strip path components and unsafe characters. */
export function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.normalize("NFC").replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 120).trim();
  return cleaned || "file";
}

/**
 * Removes privacy-sensitive metadata (EXIF incl. GPS, XMP, comments) from a JPEG
 * while preserving the orientation flag so phone photos still display upright.
 */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (!(buf[0] === 0xff && buf[1] === 0xd8)) return buf;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let orientation: number | null = null;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // malformed – keep original
    const marker = buf[i + 1]!;
    if (marker === 0xda) {
      // start of scan: rest of file is image data
      break;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.subarray(i, i + 2 + len);
    const isApp1 = marker === 0xe1;
    const isCom = marker === 0xfe;
    const isAppOther = marker >= 0xe3 && marker <= 0xef && marker !== 0xee; // keep APP0 JFIF, APP2 ICC, APP14 Adobe
    if (isApp1) {
      const o = readExifOrientation(seg.subarray(4));
      if (o) orientation = o;
    } else if (!isCom && !isAppOther) {
      out.push(seg);
    }
    i += 2 + len;
  }
  const rest = buf.subarray(i);
  const parts = [out[0]!];
  if (orientation && orientation !== 1) parts.push(minimalExif(orientation));
  parts.push(...out.slice(1), rest);
  return Buffer.concat(parts);
}

function readExifOrientation(payload: Buffer): number | null {
  if (payload.toString("ascii", 0, 4) !== "Exif") return null;
  const tiff = payload.subarray(6);
  if (tiff.length < 8) return null;
  const le = tiff.toString("ascii", 0, 2) === "II";
  const u16 = (o: number) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > tiff.length) break;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return null;
}

function minimalExif(orientation: number): Buffer {
  // APP1 "Exif\0\0" + little-endian TIFF header + IFD0 with a single Orientation entry
  const tiff = Buffer.alloc(8 + 2 + 12 + 4);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = 0xe1;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}
