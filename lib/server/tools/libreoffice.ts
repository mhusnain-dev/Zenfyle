import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ProcessingError } from "./types";

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
 * Convert an office document at `inputPath` to PDF, writing the result into
 * `workDir` and returning its absolute path. `workDir` also hosts the per-job
 * LibreOffice profile so concurrent conversions don't collide. Throws a
 * ProcessingError (mapped to a user message) if soffice fails or emits nothing.
 */
export async function convertToPdf(
  inputPath: string,
  workDir: string,
  signal: AbortSignal,
): Promise<string> {
  const profileDir = path.join(workDir, "lo-profile");
  const args = [
    "--headless",
    "--nologo",
    "--nofirststartwizard",
    `-env:UserInstallation=file://${profileDir}`,
    "--convert-to",
    "pdf",
    "--outdir",
    workDir,
    inputPath,
  ];

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

  // soffice names the output after the input basename with a .pdf extension,
  // placed in outdir. Derive that path and confirm it was actually written —
  // soffice can exit 0 having produced nothing for a document it can't read.
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(workDir, `${base}.pdf`);

  try {
    await fs.access(outputPath);
  } catch {
    throw new ProcessingError(
      "This document couldn't be converted — it may be corrupted or in an unsupported format.",
      { code: "FILE_CORRUPTED", cause: result.stderr || result.stdout },
    );
  }

  return outputPath;
}
