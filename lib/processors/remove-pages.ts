import { PDFDocument } from "pdf-lib";
import { loadPdf, toPdfBlob } from "@/lib/processors/load-pdf";
import { parsePageList } from "@/lib/processors/page-range";
import { outputFilename } from "@/lib/processors/filename";
import type { Processor } from "@/lib/processors/types";

/*
 * Remove Pages — Section 11.5 (client, pdf-lib) + 11.6: delete specific pages
 * (1-based list like "2,5,9"). Builds a new document from the pages NOT in the
 * remove set, which is simpler and safer than deleting in place. Refuses to
 * remove every page — an empty PDF is never a useful result.
 */
const SLUG = "remove-pages";

export const removePages: Processor = async (input, onProgress) => {
  const file = input.files[0];
  if (!file) throw new Error("Add a PDF.");

  const spec = (input.options.pages as string) ?? "";

  onProgress(20, "Reading PDF");
  const src = await loadPdf(file);
  const pageCount = src.getPageCount();

  const toRemove = new Set(parsePageList(spec, pageCount).map((p) => p - 1));
  const keep = src.getPageIndices().filter((i) => !toRemove.has(i));

  if (keep.length === 0)
    throw new Error("That would remove every page — keep at least one.");

  onProgress(55, "Removing pages");
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, keep);
  copied.forEach((p) => out.addPage(p));

  onProgress(90, "Writing PDF");
  const blob = await toPdfBlob(out);
  onProgress(100, "Done");

  const removed = pageCount - keep.length;
  return {
    outputs: [{ blob, filename: outputFilename(SLUG, "pdf") }],
    summary: `Removed ${removed} page${removed === 1 ? "" : "s"}, ${keep.length} remaining`,
  };
};
