import { PDFDocument } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Organize Pages — Section 11.5 (client, pdf-lib) + 11.6: reorder, delete, or
 * duplicate pages. The options component hands us the final page sequence as a
 * list of 0-based source indices: reordering permutes it, deleting omits an
 * index, duplicating repeats one. We rebuild the document in exactly that
 * order. copyPages is called once with the full (possibly repeated) index list
 * so duplicated pages are independent copies.
 */
const SLUG = "organize-pages";

export const organizePages: Processor = async (input, onProgress) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF.");

  const order = input.options.order as number[] | undefined;

  onProgress(20, "Reading PDF");
  const src = await loadPdf(file);
  const pageCount = src.getPageCount();

  const sequence =
    order && order.length > 0 ? order : src.getPageIndices();

  if (sequence.some((i) => i < 0 || i >= pageCount))
    throw new Error("Page selection is out of range for this PDF.");
  if (sequence.length === 0)
    throw new Error("Keep at least one page in the document.");

  onProgress(55, "Rebuilding document");
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, sequence);
  copied.forEach((p) => out.addPage(p));

  onProgress(90, "Writing PDF");
  const blob = await toPdfBlob(out);
  onProgress(100, "Done");

  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Reorganized into ${sequence.length} page${sequence.length === 1 ? "" : "s"}`,
  };
};
