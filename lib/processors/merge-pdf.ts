import { PDFDocument } from "pdf-lib";
import { getTool } from "@/lib/registry";
import { outputFilename } from "@/lib/processors/filename";
import {
  ClientLimitExceeded,
  type Processor,
} from "@/lib/processors/types";

/*
 * Merge PDF — Section 11.5 (client, pdf-lib) + 11.6 options.
 * Accepts 2–5 PDFs, 100 MB combined max; above that the spec routes to the
 * server path (Phase 6) rather than rejecting — surfaced here as
 * ClientLimitExceeded. Files are merged in the order given (the UI lets the
 * person reorder before calling this). Merge runs only on explicit action,
 * never automatically — that's enforced by the caller.
 */

const MAX_FILES = 5;
const MIN_FILES = 2;
const MAX_COMBINED_BYTES = 100 * 1024 * 1024; // 100 MB combined

export const mergePdf: Processor = async (input, onProgress, signal) => {
  const { files } = input;

  if (files.length < MIN_FILES)
    throw new Error("Add at least 2 PDF files to merge.");

  const combined = files.reduce((sum, f) => sum + f.size, 0);
  if (files.length > MAX_FILES || combined > MAX_COMBINED_BYTES)
    throw new ClientLimitExceeded(
      "This merge is larger than the in-browser limit (5 files / 100 MB) and needs server processing, which is coming in a later build phase.",
    );

  onProgress(5, "Preparing files");

  const merged = await PDFDocument.create();
  let done = 0;

  for (const file of files) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    const bytes = await file.arrayBuffer();
    let src: PDFDocument;
    try {
      // ignoreEncryption lets us surface a clear message rather than throwing
      // deep inside pdf-lib; a truly encrypted file still can't copy pages.
      src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    } catch {
      throw new Error(
        `"${file.name}" couldn't be read as a PDF. It may be corrupted or not a real PDF.`,
      );
    }

    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));

    done += 1;
    onProgress(
      5 + Math.round((done / files.length) * 85),
      `Merging file ${done} of ${files.length}`,
    );
  }

  onProgress(95, "Writing merged PDF");
  const out = await merged.save();
  const pageCount = merged.getPageCount();

  onProgress(100, "Done");

  const slug = "merge-pdf";
  const ext = getTool(slug)?.outputExtension ?? ".pdf";
  // Copy into a fresh ArrayBuffer so Blob gets a plain ArrayBuffer, not the
  // Uint8Array's possibly-larger backing buffer.
  const body = out.slice().buffer;
  return {
    outputs: [
      {
        blob: new Blob([body], { type: "application/pdf" }),
        filename: outputFilename(slug, ext),
      },
    ],
    summary: `${files.length} files merged into 1 PDF (${pageCount} pages)`,
  };
};
