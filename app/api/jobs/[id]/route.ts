import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { getQueue } from "@/lib/queue";
import { apiError } from "@/lib/server/api-error";

/*
 * GET /api/jobs/:id (Section 6.2) — the stateless poll the frontend hits every
 * 2s while a job is queued/processing. Reads live progress the worker wrote to
 * the job row, and on success derives the signed download URL from the stored
 * output key (Section 6 download-URL decision). Response shape is exactly the
 * Section 6.2 contract; download_url appears only on success, error_message
 * only on error.
 */
export const runtime = "nodejs";

// Result note (e.g. the "already optimally sized" case) is stored in
// errorMessage on success — surface it as a message, not an error.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return apiError("UNKNOWN_ERROR", "Job not found.");
  }

  const body: {
    status: string;
    progress?: { stage: string; percent: number; message?: string };
    download_url?: string;
    error_message?: string;
    error_code?: string;
    summary?: string;
    note?: string;
  } = { status: job.status };

  if (job.status === "queued" || job.status === "processing") {
    body.progress = {
      stage: job.progressStage ?? "queued",
      percent: job.progressPercent,
    };
  }

  if (job.status === "success" && job.outputFileRef) {
    // 2h signed URL (Section 6). The download route re-checks status/expiry, so
    // this URL alone stops working once the job expires or is cancelled.
    body.download_url = await getStorage().getSignedUrl(
      job.outputFileRef,
      2 * 60 * 60,
    );
    // The adapter's real outcome line (compress ratio, compare change counts).
    if (job.resultSummary) body.summary = job.resultSummary;
    // The "already optimally sized" note rides in errorMessage on success.
    if (job.errorMessage) body.note = job.errorMessage;
  }

  if (job.status === "error") {
    body.error_message =
      job.errorMessage ?? "Something went wrong processing this file.";
    // Section 13.7 code so the client can branch (e.g. INVALID_PASSWORD).
    if (job.errorCode) body.error_code = job.errorCode;
  }

  return NextResponse.json(body);
}

/*
 * DELETE /api/jobs/:id — user-requested cancellation (Section 11.10). The queue
 * adapter aborts an in-flight job or removes a queued one; already-finished
 * jobs return { cancelled: false } so the client knows the file may still be
 * available. This is the server side of the Processing screen's Cancel button.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!job) {
    return apiError("UNKNOWN_ERROR", "Job not found.");
  }
  const queue = await getQueue();
  const cancelled = await queue.cancel(id);
  return NextResponse.json({ cancelled });
}
