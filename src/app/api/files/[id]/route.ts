import { getCurrentUser } from "@/lib/auth/session";
import { route } from "@/lib/http";
import { readAttachment } from "@/server/services/reports";

/** GET /api/files/:attachmentId – streams a stored file after an access check. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const actor = await getCurrentUser();
  const file = await readAttachment(actor, params.id);
  const download = new URL(req.url).searchParams.get("download") === "1";
  const encoded = encodeURIComponent(file.name);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.mimeType,
      "content-length": String(file.data.length),
      "content-disposition": `${download || file.mimeType === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cache-control": file.isPublic ? "public, max-age=86400" : "private, no-store",
    },
  });
});
