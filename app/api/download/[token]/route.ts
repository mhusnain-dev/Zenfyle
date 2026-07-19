import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getStorage, decodeStorageToken } from "@/lib/storage";
import { apiError } from "@/lib/server/api-error";

/*
 * GET /api/download/:token — serves a completed job's output. The token is the
 * output storage key, base64url-encoded (LocalDiskProvider.getSignedUrl). This
 * is the enforcement point for the signed-URL decision (Section 6): the token
 * being unguessable isn't the only control — we re-check the job's status and
 * expiry against the DB here, so a leaked/old URL stops resolving the moment
 * the job is cancelled or its 2h window passes.
 */
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  let key: string;
  try {
    key = decodeStorageToken(token);
  } catch {
    return apiError("UNKNOWN_ERROR", "Invalid download link.");
  }

  // Resolve the job by its output key (unique). Enforce state from the DB.
  const job = await prisma.job.findUnique({ where: { outputFileRef: key } });
  if (!job) {
    return apiError("UNKNOWN_ERROR", "This download is no longer available.");
  }
  if (job.status === "expired") {
    return apiError(
      "UNKNOWN_ERROR",
      "This download has expired. Files are deleted 2 hours after processing.",
    );
  }
  if (job.status !== "success") {
    return apiError("UNKNOWN_ERROR", "This file isn't ready for download.");
  }
  if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
    return apiError(
      "UNKNOWN_ERROR",
      "This download has expired. Files are deleted 2 hours after processing.",
    );
  }

  let buffer: Buffer;
  try {
    buffer = await getStorage().get(key);
  } catch {
    // File gone but row not yet marked expired (cleanup race) — treat as gone.
    return apiError("UNKNOWN_ERROR", "This download is no longer available.");
  }

  const filename = key.split("/").pop() ?? "download";

  const contentType = contentTypeFor(filename);
  // Wrap the bytes in a Blob — a clean web BodyInit that sidesteps the
  // Node Buffer / ArrayBufferLike friction with NextResponse's typing.
  const body = new Blob([new Uint8Array(buffer)], { type: contentType });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      // Never cache: the URL is short-lived and content is per-user.
      "Cache-Control": "no-store, private",
    },
  });
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}
