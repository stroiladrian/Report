import { describe, expect, it } from "vitest";
import { safeDisplayName, sniffMime, storageKeyFor, stripJpegMetadata, validateUpload } from "@/server/domain/files";
import { formatReportNumber } from "@/server/services/reports";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const PDF = Buffer.from("%PDF-1.7\n");
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);

/** Builds a JPEG with an EXIF APP1 containing Orientation=6 and a GPS IFD pointer. */
function jpegWithExif() {
  const tiff = Buffer.alloc(8 + 2 + 24 + 4);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(2, 8);
  tiff.writeUInt16LE(0x0112, 10); // orientation
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(6, 18);
  tiff.writeUInt16LE(0x8825, 22); // GPS IFD pointer
  tiff.writeUInt16LE(4, 24);
  tiff.writeUInt32LE(1, 26);
  tiff.writeUInt32LE(0xdeadbeef, 30);
  const payload = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff, Buffer.from("GPS-SECRET-46.77,23.62")]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(payload.length + 2) >> 8, (payload.length + 2) & 255]), payload]);
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x07, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  const com = Buffer.concat([Buffer.from([0xff, 0xfe, 0x00, 0x0a]), Buffer.from("camera12")]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, com, sos]);
}

describe("file validation", () => {
  it("detects types by magic bytes", () => {
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(PDF)).toBe("application/pdf");
    expect(sniffMime(WEBP)).toBe("image/webp");
    expect(sniffMime(jpegWithExif())).toBe("image/jpeg");
    expect(sniffMime(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });

  it("rejects spoofed extensions and unsupported content", () => {
    expect(validateUpload({ name: "a.png", size: PNG.length, data: PNG })).toMatchObject({ ok: true, mime: "image/png" });
    expect(validateUpload({ name: "a.jpg", size: PNG.length, data: PNG })).toEqual({ ok: false, reason: "extension" });
    const html = Buffer.from("<html><script>alert(1)</script>");
    expect(validateUpload({ name: "x.png", size: html.length, data: html })).toEqual({ ok: false, reason: "type" });
    expect(validateUpload({ name: "x.exe", size: 0, data: Buffer.alloc(0) })).toEqual({ ok: false, reason: "empty" });
  });

  it("enforces size limits", () => {
    expect(validateUpload({ name: "a.png", size: 10, data: PNG }, { maxBytes: 5 })).toEqual({ ok: false, reason: "size" });
  });

  it("strips EXIF/GPS and comments but keeps orientation", () => {
    const src = jpegWithExif();
    const out = stripJpegMetadata(src);
    expect(out.includes(Buffer.from("GPS-SECRET"))).toBe(false);
    expect(out.includes(Buffer.from("camera12"))).toBe(false);
    expect(out.includes(Buffer.from("JFIF"))).toBe(true);
    // orientation 6 preserved in a minimal EXIF segment
    const idx = out.indexOf(Buffer.from([0x12, 0x01, 0x03, 0x00]));
    expect(idx).toBeGreaterThan(0);
    expect(out.readUInt16LE(idx + 8)).toBe(6);
    expect(out.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it("produces safe names and keys", () => {
    expect(safeDisplayName("../../etc/passwd")).toBe("passwd");
    expect(safeDisplayName("poză <script>.jpg")).toBe("poză _script_.jpg");
    expect(storageKeyFor("jpg", new Date("2026-03-05T00:00:00Z"))).toMatch(/^2026\/03\/[0-9a-f-]{36}\.jpg$/);
  });

  it("formats report numbers", () => {
    expect(formatReportNumber(2026, 42, "CR")).toBe("CR2026-000042");
  });
});
