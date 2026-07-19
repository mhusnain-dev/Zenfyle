import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
  ServerProcessor,
} from "./types";
import { ProcessingError } from "./types";

/*
 * Compress PDF adapter (Section 11.5) — the ONLY place Ghostscript is invoked
 * (adapter pattern, Section 11.1/585). Maps the shared Low/Medium/High presets
 * (Section 11.6) to Ghostscript's -dPDFSETTINGS distiller profiles:
 *   Low compression  -> /prepress (highest quality, largest)  = "squeeze least"
 *   Medium           -> /ebook    (balanced)
 *   High compression -> /screen   (smallest, lowest quality)  = "squeeze most"
 *
 * Never-larger-than-input rule (Section 11.6): if Ghostscript's output is not
 * smaller than the source, we return the original file unchanged and set a note.
 */
const PRESET_TO_PDFSETTINGS: Record<string, string> = {
  low: "/prepress",
  medium: "/ebook",
  high: "/screen",
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function runGhostscript(
  args: string[],
  signal: AbortSignal,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const gs = spawn("gs", args, { signal });
    let stderr = "";
    gs.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    gs.on("error", (err) => reject(err));
    gs.on("close", (code) => resolve({ code, stderr }));
  });
}

export const compressPdf: ServerProcessor = async (
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> => {
  const preset = (input.options.preset as string) || "medium";
  const pdfSettings = PRESET_TO_PDFSETTINGS[preset] ?? PRESET_TO_PDFSETTINGS.medium;

  const outputName = `zenfyle-compress-pdf-${input.shortId}.pdf`;
  const outputPath = path.join(input.workDir, outputName);

  await onProgress("compressing", 10);

  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=${pdfSettings}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    // Fail rather than prompt if the PDF is password-protected/encrypted.
    "-dPDFSTOPONERROR",
    `-sOutputFile=${outputPath}`,
    input.inputPath,
  ];

  let result: { code: number | null; stderr: string };
  try {
    result = await runGhostscript(args, signal);
  } catch (err) {
    if (signal.aborted) throw err; // cancellation — let the pipeline handle it
    throw new ProcessingError(
      "Couldn't run the PDF compressor on this file.",
      { cause: err },
    );
  }

  if (signal.aborted) throw new Error("cancelled");

  if (result.code !== 0) {
    // Ghostscript non-zero: most often an encrypted or malformed PDF.
    throw new ProcessingError(
      "This PDF couldn't be compressed — it may be password-protected or damaged. Try Unlock PDF first.",
      { cause: result.stderr },
    );
  }

  await onProgress("checking size", 80);

  const [inStat, outStat] = await Promise.all([
    fs.stat(input.inputPath),
    fs.stat(outputPath),
  ]);

  const originalSize = inStat.size;
  const compressedSize = outStat.size;

  // Never return a larger file (Section 11.6): fall back to the original.
  if (compressedSize >= originalSize) {
    await fs.copyFile(input.inputPath, outputPath);
    await onProgress("finishing", 100);
    return {
      outputs: [{ path: outputPath, filename: outputName }],
      summary: `Already optimally sized (${fmtBytes(originalSize)})`,
      note: "This PDF was already well compressed, so we kept the original file to avoid making it larger.",
    };
  }

  await onProgress("finishing", 100);

  const saved = originalSize - compressedSize;
  const pct = Math.round((saved / originalSize) * 100);
  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary: `Compressed from ${fmtBytes(originalSize)} to ${fmtBytes(
      compressedSize,
    )} (${pct}% smaller)`,
  };
};
