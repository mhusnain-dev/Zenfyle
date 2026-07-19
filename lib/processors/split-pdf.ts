import { PDFDocument } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { parsePageList } from "@/lib/processors/page-range";
import { outputFilename } from "@/lib/processors/filename";
import type { OutputFile, Processor } from "@/lib/processors/types";

/*
 * Split PDF — Section 11.5 (client, pdf-lib) + 11.6 options.
 * Two modes:
 *   - "each": every page becomes its own single-page PDF.
 *   - "at": split at specific 1-based page numbers (e.g. "3,7,10") into
 *     contiguous chunks — a split point starts a new file at that page, so
 *     "3,7" on a 10-page doc yields pages 1-2, 3-6, 7-10.
 * Returns the raw per-file list; the >3-files ZIP rule is applied centrally
 * (package-outputs), not here.
 */
type SplitMode = "each" | "at";

const SLUG = "split-pdf";

async function pagesToPdf(src: PDFDocument, indices: number[]): Promise<Blob> {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  copied.forEach((p) => out.addPage(p));
  return toPdfBlob(out);
}

// Build contiguous [start,end) chunks from 1-based split points.
function chunksFromSplitPoints(splitPoints: number[], pageCount: number): number[][] {
  const boundaries = [0, ...splitPoints.map((p) => p - 1), pageCount].filter(
    (v, i, a) => a.indexOf(v) === i && v >= 0 && v <= pageCount,
  );
  boundaries.sort((a, b) => a - b);
  const chunks: number[][] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const from = boundaries[i];
    const to = boundaries[i + 1];
    if (to > from) chunks.push(Array.from({ length: to - from }, (_, k) => from + k));
  }
  return chunks;
}

export const splitPdf: Processor = async (input, onProgress, signal) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF to split.");

  const mode = (input.options.mode as SplitMode) ?? "each";
  const atPages = (input.options.pages as string) ?? "";

  onProgress(10, "Reading PDF");
  const src = await loadPdf(file);
  const pageCount = src.getPageCount();

  let chunks: number[][];
  if (mode === "at") {
    // Split points must be within 2..pageCount (a split at page 1 is a no-op).
    const points = parsePageList(atPages, pageCount).filter((p) => p > 1);
    if (points.length === 0)
      throw new Error(
        `Enter at least one page to split at, between 2 and ${pageCount}.`,
      );
    chunks = chunksFromSplitPoints(points, pageCount);
  } else {
    chunks = src.getPageIndices().map((i) => [i]);
  }

  const outputs: OutputFile[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const blob = await pagesToPdf(src, chunks[i]);
    const part = String(i + 1).padStart(2, "0");
    outputs.push({
      blob,
      filename: outputFilename(SLUG, "pdf").replace(/\.pdf$/, `-p${part}.pdf`),
    });
    onProgress(10 + Math.round(((i + 1) / chunks.length) * 85), `Writing file ${i + 1} of ${chunks.length}`);
  }

  onProgress(100, "Done");
  return {
    outputs,
    summary:
      mode === "each"
        ? `Split into ${outputs.length} single-page PDFs`
        : `Split into ${outputs.length} PDFs at the chosen pages`,
  };
};
