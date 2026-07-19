import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTool } from "@/lib/registry";
import { getStorage, storageKeys, SECOND_INPUT_FILENAME } from "@/lib/storage";
import { getQueue } from "@/lib/queue";
import { isServerToolImplemented } from "@/lib/server/tools";
import { validateUpload } from "@/lib/server/validate-upload";
import { apiError } from "@/lib/server/api-error";
import { auth } from "@/auth";
import { getRateLimiter } from "@/lib/server/rate-limit";

/*
 * POST /api/jobs (Section 6.2) — the single entry point for server-side tools.
 * multipart body { tool_slug, file[, options] } → { job_id, status: "queued" }.
 *
 * Flow: validate request → resolve + gate the tool → content-validate the file
 * (Section 6.3, magic bytes / zero-byte / size, server-side) → create the job
 * row → store the input → enqueue. Rate-limit ENFORCEMENT is Phase 7 (spec
 * line 414); we already record a usage_event here so that phase has data and
 * only needs to add the counter check, not new plumbing.
 */

// Node runtime (not Edge): we use node:crypto, Buffer, and the storage/queue
// layers which touch the filesystem and Prisma.
export const runtime = "nodejs";

const OptionsSchema = z.record(z.string(), z.unknown());

function hashIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || "unknown";
  // Salt so the stored hash isn't a plain reversible IP (Section 6.1 ip_hash).
  const salt = process.env.IP_HASH_SALT ?? "zenfyle-dev-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError("FILE_CORRUPTED", "The upload could not be read.");
  }

  const toolSlug = form.get("tool_slug");
  const file = form.get("file");
  const rawOptions = form.get("options");

  if (typeof toolSlug !== "string" || !toolSlug) {
    return apiError("UNSUPPORTED_FILE_TYPE", "Missing tool selection.");
  }
  if (!(file instanceof File)) {
    return apiError("FILE_CORRUPTED", "No file was uploaded.");
  }

  // Resolve + gate the tool. A direct API hit on a client-only, comingSoon, or
  // unimplemented tool is rejected as TOOL_UNAVAILABLE (Section 13.7).
  const tool = getTool(toolSlug);
  if (!tool || tool.processing !== "server") {
    return apiError("TOOL_UNAVAILABLE", "This tool isn't available.");
  }
  if (tool.status === "comingSoon" || tool.status === "disabled") {
    return apiError("TOOL_UNAVAILABLE", "This tool isn't available yet.");
  }
  if (!isServerToolImplemented(toolSlug)) {
    return apiError("TOOL_UNAVAILABLE", "This tool isn't available yet.");
  }

  // Identify the requester: a logged-in user (higher cap, §13.4) or anonymous
  // (limited by salted IP hash). The session drives both rate limiting and job
  // ownership for the dashboard's job history.
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const ipHash = hashIp(req);

  // Concurrency guard (§11.10 / §618): one active server job per identity at a
  // time. A second upload while one is queued/processing is rejected with a
  // clear message rather than silently queued behind it. Scoped by userId for
  // logged-in users and by ipHash for anonymous ones (hence ipHash on the job).
  const activeCount = await prisma.job.count({
    where: {
      status: { in: ["queued", "processing"] },
      ...(userId ? { userId } : { userId: null, ipHash }),
    },
  });
  if (activeCount > 0) {
    return apiError(
      "QUEUE_FULL",
      "Please wait for your current job to finish before starting another.",
    );
  }

  // Daily cap (§13.4): 20/day anon, 50/day logged-in. Checked before we accept
  // the upload so an over-cap request fails fast (413/429) without storing bytes.
  const rateLimit = await getRateLimiter().check(
    userId ? { kind: "user", userId } : { kind: "anon", ipHash },
  );
  if (!rateLimit.allowed) {
    return apiError(
      "RATE_LIMIT_EXCEEDED",
      userId
        ? `You've reached your daily limit of ${rateLimit.limit} operations. Try again tomorrow.`
        : `You've reached the free daily limit of ${rateLimit.limit} operations. Sign up for a higher limit, or try again tomorrow.`,
    );
  }

  // Parse options if present (same shape the client OptionsPanel emits).
  let options: Record<string, unknown> = {};
  if (typeof rawOptions === "string" && rawOptions.length > 0) {
    try {
      options = OptionsSchema.parse(JSON.parse(rawOptions));
    } catch {
      return apiError("UNSUPPORTED_FILE_TYPE", "Invalid tool options.");
    }
  }

  // Pull any password OUT of options before anything is persisted (v1.4.1): it
  // must never land in optionsJson/the DB/the dashboard history. It's delivered
  // to the worker via a short-lived storage object (the "secret" side-channel)
  // and handed to qpdf over stdin — never argv. See lib/server/tools/qpdf.ts.
  let secret: string | undefined;
  if (typeof options.password === "string" && options.password.length > 0) {
    secret = options.password;
  }
  delete options.password;

  // Content-based validation (Section 6.3) — never trust extension or client.
  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = validateUpload(
    buffer,
    tool.acceptedTypes,
    tool.maxFileSizeMb,
  );
  if (!validation.ok) {
    return apiError(validation.code, validation.message);
  }

  // Two-file server tools (compare-pdf) carry a second document in `file2`.
  // It goes in the same per-job namespace under a fixed key (§6.2 kept its
  // single-`file` contract; this is an additive side input, like the secret).
  // Validated with the same magic-byte check before the job is created.
  let secondBuffer: Buffer | null = null;
  if (tool.acceptsMultipleFiles) {
    const file2 = form.get("file2");
    if (!(file2 instanceof File)) {
      return apiError("FILE_CORRUPTED", "This tool needs two files to compare.");
    }
    secondBuffer = Buffer.from(await file2.arrayBuffer());
    const validation2 = validateUpload(
      secondBuffer,
      tool.acceptedTypes,
      tool.maxFileSizeMb,
    );
    if (!validation2.ok) {
      return apiError(validation2.code, validation2.message);
    }
  }

  // Create the job row, then store the input under its id namespace.
  const job = await prisma.job.create({
    data: {
      userId,
      ipHash,
      toolSlug,
      status: "queued",
      originalFilename: file.name.slice(0, 255),
      mimeType: validation.mimeType,
      fileSizeBytes: buffer.byteLength,
      optionsJson: Object.keys(options).length ? JSON.stringify(options) : null,
    },
  });

  try {
    const inputKey = storageKeys.input(job.id, "input" + extOf(tool.acceptedTypes, file.name));
    await getStorage().save(buffer, inputKey);
    await prisma.job.update({
      where: { id: job.id },
      data: { inputFileRef: inputKey },
    });

    // Stash the password (if any) as the job's out-of-band secret. The worker
    // reads and deletes it before running the adapter; cleanupJob sweeps it too.
    if (secret !== undefined) {
      await getStorage().save(
        Buffer.from(secret, "utf8"),
        storageKeys.secret(job.id),
      );
    }

    // Store the second input (compare-pdf) under its fixed key. Not tracked in
    // a DB column; the worker reconstructs the key from the job id and cleanup
    // sweeps it the same way.
    if (secondBuffer) {
      await getStorage().save(
        secondBuffer,
        storageKeys.input2(job.id, SECOND_INPUT_FILENAME),
      );
    }

    // Record usage for rate-limiting/analytics (Section 6.1). This row IS the
    // rate-limit increment the DbRateLimiter counts, so it must be written for
    // every accepted job (userId scopes logged-in caps, ipHash scopes anon).
    await prisma.usageEvent.create({
      data: { userId, ipHash, toolSlug },
    });

    const queue = await getQueue();
    await queue.enqueue(job.id);
  } catch (err) {
    console.error("[POST /api/jobs] enqueue failed:", err);
    await prisma.job
      .update({
        where: { id: job.id },
        data: { status: "error", errorMessage: "Could not start processing." },
      })
      .catch(() => {});
    return apiError("WORKER_ERROR", "Could not start processing this file.");
  }

  return NextResponse.json({ job_id: job.id, status: "queued" });
}

/** Pick the input file extension to store under (validated, so it's safe). */
function extOf(acceptedTypes: readonly string[], filename: string): string {
  const lower = filename.toLowerCase();
  const match = acceptedTypes.find((e) => lower.endsWith(e.toLowerCase()));
  return match ?? acceptedTypes[0] ?? "";
}
