import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ServerProcessInput,
  ServerProcessResult,
  ServerProgressReporter,
  ServerProcessor,
} from "./types";
import { convertToPdf } from "./libreoffice";

/*
 * Word to PDF adapter (Section 11.5) — converts a .docx/.doc to PDF via
 * LibreOffice (the single soffice spawn point in ./libreoffice). This direction
 * is lossless and reliable (unlike the PDF→Word reverse), which is why it's the
 * Phase 8 pilot. No options (NoOptions in the registry).
 */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export const wordToPdf: ServerProcessor = async (
  input: ServerProcessInput,
  onProgress: ServerProgressReporter,
  signal: AbortSignal,
): Promise<ServerProcessResult> => {
  await onProgress("converting", 20);

  const producedPath = await convertToPdf(input.inputPath, input.workDir, signal);

  if (signal.aborted) throw new Error("cancelled");

  // Rename to the spec's output convention (zenfyle-{slug}-{shortId}.pdf).
  const outputName = `zenfyle-word-to-pdf-${input.shortId}.pdf`;
  const outputPath = path.join(input.workDir, outputName);
  await fs.rename(producedPath, outputPath);

  await onProgress("finishing", 100);

  const { size } = await fs.stat(outputPath);
  return {
    outputs: [{ path: outputPath, filename: outputName }],
    summary: `Converted to PDF (${fmtBytes(size)}).`,
  };
};
