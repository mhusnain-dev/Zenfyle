/*
 * Server-side processing adapter contract (Section 11.5 "Server" tools, and the
 * adapter pattern in 11.1/585: no processing library — Ghostscript, LibreOffice,
 * qpdf — is ever imported outside one of these adapter files). The worker
 * pipeline (process-job.ts) looks the adapter up by tool slug, so adding a
 * server tool is one file here + a registry entry, mirroring the client side.
 */

import type { ErrorCode } from "@/lib/server/api-error";

export type ServerOutputFile = {
  /** Absolute path to the produced file on the local working dir. */
  path: string;
  /** Output filename following the zenfyle-{slug}-{shortId}[-pNN].{ext} rule. */
  filename: string;
};

export type ServerProcessInput = {
  /** Absolute path to the validated input file the worker wrote to disk. */
  inputPath: string;
  /**
   * Absolute path to the second input, present only for two-file tools
   * (compare-pdf). The worker downloads it from the job's `in2/` namespace
   * before running the adapter; undefined for every single-file tool.
   */
  secondInputPath?: string;
  /** Original upload filename (for messages only — never trusted for paths). */
  originalFilename: string;
  /** Tool options from the request (same shape the client OptionsPanel emits). */
  options: Record<string, unknown>;
  /**
   * A per-job secret (currently the PDF password for Protect/Unlock) delivered
   * out-of-band from `options` so it is never persisted in optionsJson or the
   * dashboard history (v1.4.1). The pipeline reads it from a short-lived storage
   * object and deletes that object before running the adapter; adapters must
   * pass it to a child process via stdin, never argv. Undefined when no secret
   * was supplied.
   */
  secret?: string;
  /** Short id (from the job) used to build spec-compliant output names. */
  shortId: string;
  /** A scratch dir unique to this job the adapter may write outputs into. */
  workDir: string;
};

/** Report coarse progress; percent is always an integer 0–100 (Section 6.2). */
export type ServerProgressReporter = (
  stage: string,
  percent: number,
) => void | Promise<void>;

export type ServerProcessResult = {
  outputs: ServerOutputFile[];
  /** Result-screen summary, e.g. "Compressed from 4.2 MB to 1.1 MB (74% smaller)". */
  summary: string;
  /** Optional note, e.g. the "already optimally sized" case (Section 11.6). */
  note?: string;
};

export type ServerProcessor = (
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
) => Promise<ServerProcessResult>;

/*
 * Raised by an adapter when the input is structurally unusable in a way the
 * generic validator can't catch (e.g. a password-protected PDF Ghostscript
 * can't open). The pipeline maps this to a FILE_CORRUPTED-style error_message
 * instead of a generic failure (Section 13.7).
 */
export class ProcessingError extends Error {
  readonly userMessage: string;
  /**
   * Optional Section 13.7 error code so the pipeline can persist a code the
   * client branches on (e.g. INVALID_PASSWORD → re-prompt for the password)
   * instead of parsing the message text. Defaults to FILE_CORRUPTED-style
   * handling when unset (the generic "bad input" case this class models).
   */
  readonly code?: ErrorCode;
  constructor(userMessage: string, opts?: { code?: ErrorCode; cause?: unknown }) {
    super(userMessage);
    this.name = "ProcessingError";
    this.userMessage = userMessage;
    this.code = opts?.code;
    if (opts?.cause) this.cause = opts.cause;
  }
}
