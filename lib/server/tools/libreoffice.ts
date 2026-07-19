import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ProcessingError } from "./types";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
  ServerProcessor,
} from "./types";

/*
 * LibreOffice integration (Section 11.5) — the ONE place `soffice` is invoked
 * (adapter pattern, Section 11.1/585). Every LibreOffice-backed conversion
 * (Word/Excel/PPT ↔ PDF) goes through convertToPdf here, so the spawn logic,
 * profile isolation, and error mapping live in a single module.
 *
 * Headless conversion: `soffice --headless --convert-to pdf --outdir <dir> <in>`
 * writes "<inputBasename>.pdf" into outdir. Two gotchas handled here:
 *   1. soffice refuses to start a second instance that shares a user profile,
 *      which breaks concurrency. We hand each job its OWN profile dir via
 *      `-env:UserInstallation=file://<workDir>/lo-profile` so parallel jobs on
 *      the worker (BullMQ concurrency 2) don't collide on a single ~/.config.
 *   2. soffice exits 0 even when it produced nothing for a broken input, so we
 *      verify the output file actually exists rather than trusting the code.
 */

function runSoffice(
  args: string[],
  signal: AbortSignal,
): Promise<{ code: number | null; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    // `soffice` and `libreoffice` are the same binary; soffice is the canonical
    // headless entry point and is on PATH (/usr/bin/soffice).
    const proc = spawn("soffice", args, { signal });
    let stderr = "";
    let stdout = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => resolve({ code, stderr, stdout }));
  });
}

/**
 * Core soffice conversion: convert `inputPath` to `targetExt` (e.g. "pdf",
 * "docx", "pptx"), writing into `workDir` and returning the produced file's
 * absolute path. `infilter` forces the import filter — required for the reverse
 * PDF→Office direction (e.g. "writer_pdf_import"), omitted for the forward
 * direction where soffice auto-detects. `workDir` also hosts the per-job
 * LibreOffice profile so concurrent conversions don't collide. Throws a
 * ProcessingError if soffice fails or emits nothing (it can exit 0 having
 * produced no output for a document it can't actually read).
 */
export async function convert(
  inputPath: string,
  targetExt: string,
  workDir: string,
  signal: AbortSignal,
  infilter?: string,
): Promise<string> {
  const profileDir = path.join(workDir, "lo-profile");
  const args = [
    "--headless",
    "--nologo",
    "--nofirststartwizard",
    `-env:UserInstallation=file://${profileDir}`,
  ];
  if (infilter) args.push(`-infilter=${infilter}`);
  args.push("--convert-to", targetExt, "--outdir", workDir, inputPath);

  let result: { code: number | null; stderr: string; stdout: string };
  try {
    result = await runSoffice(args, signal);
  } catch (err) {
    if (signal.aborted) throw err; // cancellation — let the pipeline handle it
    throw new ProcessingError(
      "Couldn't run the document converter on this file.",
      { cause: err },
    );
  }

  if (signal.aborted) throw new Error("cancelled");

  // soffice names the output after the input basename with the target ext,
  // placed in outdir. Derive that path and confirm it was actually written.
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(workDir, `${base}.${targetExt}`);

  try {
    await fs.access(outputPath);
  } catch {
    throw new ProcessingError(
      "This document couldn't be converted — it may be corrupted, encrypted, or in an unsupported format.",
      { code: "FILE_CORRUPTED", cause: result.stderr || result.stdout },
    );
  }

  return outputPath;
}

/** Backwards-compatible helper: convert any office doc to PDF. */
export async function convertToPdf(
  inputPath: string,
  workDir: string,
  signal: AbortSignal,
): Promise<string> {
  return convert(inputPath, "pdf", workDir, signal);
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/*
 * Factory for the "office document → PDF" server tools (Word/Excel/PPT → PDF).
 * All three are the same lossless LibreOffice conversion differing only in the
 * output filename slug, so each adapter is one line: `makeToPdfConverter("...")`.
 * The reverse direction (PDF → Office) is lossy and gets its own adapters.
 */
export function makeToPdfConverter(slug: string): ServerProcessor {
  return async (
    input: ServerProcessInput,
    onProgress: ServerProgressReporter,
    signal: AbortSignal,
  ): Promise<ServerProcessResult> => {
    await onProgress("converting", 20);

    const producedPath = await convertToPdf(input.inputPath, input.workDir, signal);
    if (signal.aborted) throw new Error("cancelled");

    // Rename to the spec's output convention (zenfyle-{slug}-{shortId}.pdf).
    const outputName = `zenfyle-${slug}-${input.shortId}.pdf`;
    const outputPath = path.join(input.workDir, outputName);
    await fs.rename(producedPath, outputPath);

    await onProgress("finishing", 100);

    const { size } = await fs.stat(outputPath);
    return {
      outputs: [{ path: outputPath, filename: outputName }],
      summary: `Converted to PDF (${fmtBytes(size)}).`,
    };
  };
}

/*
 * Factory for the "PDF → office document" reverse tools. This direction is
 * inherently LOSSY — a PDF has no editable document model, so LibreOffice
 * reconstructs one from the page content: PDF→Word (writer_pdf_import) recovers
 * flowing text but not the exact layout; PDF→PPT (impress_pdf_import) places
 * each page as an image on a slide. We surface an honest `note` on every result
 * rather than implying a perfect round-trip (§4.1c honesty rule). PDF→Excel is
 * deliberately NOT built: LibreOffice has no PDF→Calc import filter, and faking
 * table extraction would violate the anti-hallucination rule (§588) — it stays
 * comingSoon until a real table-extraction engine is available.
 */
export function makeFromPdfConverter(
  slug: string,
  targetExt: string,
  infilter: string,
  note: string,
): ServerProcessor {
  return async (
    input: ServerProcessInput,
    onProgress: ServerProgressReporter,
    signal: AbortSignal,
  ): Promise<ServerProcessResult> => {
    await onProgress("converting", 20);

    const producedPath = await convert(
      input.inputPath,
      targetExt,
      input.workDir,
      signal,
      infilter,
    );
    if (signal.aborted) throw new Error("cancelled");

    const outputName = `zenfyle-${slug}-${input.shortId}.${targetExt}`;
    const outputPath = path.join(input.workDir, outputName);
    await fs.rename(producedPath, outputPath);

    await onProgress("finishing", 100);

    const { size } = await fs.stat(outputPath);
    return {
      outputs: [{ path: outputPath, filename: outputName }],
      summary: `Converted to ${targetExt.toUpperCase()} (${fmtBytes(size)}).`,
      note,
    };
  };
}
